import type { Hono } from 'hono';
import {
  getKycSummaryForAccount,
  makeError,
  readJsonBody,
  requireAuthenticatedAccount,
  saveAccountKyc,
  type Env,
  type WorkerBindings,
} from '../core';

type KycProviderUser = {
  address?: string | null;
  dob?: string | null;
  email?: string | null;
  home?: string | null;
  id?: number | string;
  id_number?: string | null;
  kyc_image_back?: string | null;
  kyc_image_front?: string | null;
  name?: string | null;
  nationality?: string | null;
  phone?: string | null;
  sex?: string | null;
};

type KycProviderResponse = {
  data?: KycProviderUser;
  error?: string | { code?: string; message?: string; trace_id?: string };
  message?: string;
  success?: boolean;
};

const KYC_PROVIDER_ID_CARD_PATH = '/api/users/kyc/id-card';
const KYC_LOG_SERVICE = 'privy-stellar-api';

type KycLogLevel = 'error' | 'info' | 'warn';

function kycLog(
  level: KycLogLevel,
  event: string,
  details: Record<string, unknown> = {},
) {
  const entry = JSON.stringify({
    event,
    service: KYC_LOG_SERVICE,
    timestamp: new Date().toISOString(),
    ...details,
  });

  if (level === 'error') {
    console.error(entry);
    return;
  }

  if (level === 'warn') {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

function getPaymentBaseUrl(env: Env) {
  const value = String(env.PAYMENT_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');

  if (!value) {
    throw makeError('Payment API is not configured', 503);
  }

  return value;
}

function getPartnerKey(env: Env) {
  const value = String(env.PAYMENT_PARTNER_APP_KEY || '').trim();

  if (!value) {
    throw makeError('Payment partner key is not configured', 503);
  }

  return value;
}

type KycImageFile = {
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
  sourceBase64Chars: number;
};

type MultipartFile = {
  bytes: ArrayBuffer;
  contentType: string;
  filename: string;
};

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce(
    (sum, chunk) => sum + chunk.byteLength,
    0,
  );
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return result;
}

function buildMultipartBody(
  fields: Record<string, string>,
  files: Record<string, MultipartFile>,
) {
  const boundary = `----PrivyStellarBoundary${crypto
    .randomUUID()
    .replace(/-/g, '')}`;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
          `${value}\r\n`,
      ),
    );
  }

  for (const [name, file] of Object.entries(files)) {
    chunks.push(
      encoder.encode(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${name}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${file.contentType}\r\n\r\n`,
      ),
    );
    chunks.push(new Uint8Array(file.bytes));
    chunks.push(encoder.encode('\r\n'));
  }

  chunks.push(encoder.encode(`--${boundary}--\r\n`));

  return {
    body: concatBytes(chunks),
    boundary,
  };
}

function decodeBase64Image(value: unknown): KycImageFile | null {
  const raw = String(value || '').trim();
  const dataUrlMatch = raw.match(
    /^data:(image\/(?:jpeg|jpg|png));base64,([\s\S]+)$/i,
  );
  const contentType = dataUrlMatch?.[1]?.toLowerCase() || 'image/jpeg';
  const stripped = String(dataUrlMatch?.[2] || raw).replace(/\s+/g, '');

  if (!stripped || stripped.length < 100) {
    return null;
  }

  try {
    const binary = atob(stripped);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return {
      bytes: bytes.buffer as ArrayBuffer,
      contentType: contentType === 'image/jpg' ? 'image/jpeg' : contentType,
      extension: contentType === 'image/png' ? 'png' : 'jpg',
      sourceBase64Chars: stripped.length,
    };
  } catch {
    return null;
  }
}

function readUint16(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function getImageDimensions(image: KycImageFile) {
  const bytes = new Uint8Array(image.bytes);

  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      height: readUint32(bytes, 20),
      width: readUint32(bytes, 16),
    };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;

    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = bytes[offset + 1];

      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }

      const segmentLength = readUint16(bytes, offset + 2);

      if (segmentLength < 2 || offset + segmentLength + 2 > bytes.length) {
        break;
      }

      const isStartOfFrame =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);

      if (isStartOfFrame) {
        return {
          height: readUint16(bytes, offset + 5),
          width: readUint16(bytes, offset + 7),
        };
      }

      offset += segmentLength + 2;
    }
  }

  return null;
}

function getImageLogFields(image: KycImageFile, side: 'back' | 'front') {
  const dimensions = getImageDimensions(image);

  return {
    [`${side}Base64Chars`]: image.sourceBase64Chars,
    [`${side}Bytes`]: image.bytes.byteLength,
    [`${side}ContentType`]: image.contentType,
    [`${side}Extension`]: image.extension,
    [`${side}Height`]: dimensions?.height || null,
    [`${side}Orientation`]: dimensions
      ? dimensions.width > dimensions.height
        ? 'landscape'
        : dimensions.width < dimensions.height
          ? 'portrait'
          : 'square'
      : 'unknown',
    [`${side}Width`]: dimensions?.width || null,
  };
}

function normalizePhone(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 15);
}

function getProviderResponseLog(
  body: KycProviderResponse | null,
  text: string,
) {
  if (!body) {
    return {
      providerResponseFormat: text ? 'non_json' : 'empty',
      providerResponsePreview: text.slice(0, 2_000) || null,
    };
  }

  const providerError =
    typeof body.error === 'string'
      ? { message: body.error }
      : body.error
        ? {
            code: body.error.code,
            message: body.error.message,
            traceId: body.error.trace_id,
          }
        : null;

  return {
    providerDataFields: body.data ? Object.keys(body.data).sort() : [],
    providerError,
    providerMessage: body.message || null,
    providerResponseFormat: 'json',
    providerSuccess: body.success === true,
    providerUserId: body.data?.id != null ? String(body.data.id) : null,
  };
}

function formatProviderFailure(status: number, body: unknown, text: string) {
  return JSON.stringify({
    providerEndpoint: KYC_PROVIDER_ID_CARD_PATH,
    providerResponse: body ?? (text || null),
    providerStatus: status,
  });
}

async function sha256Hex(value: string) {
  if (!value) {
    return '';
  }

  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function submitProviderKyc(
  env: Env,
  requestId: string,
  payload: {
    email: string;
    imageBack: KycImageFile;
    imageFront: KycImageFile;
    phone?: string;
  },
) {
  let response: Response;
  const startedAt = Date.now();
  const fields: Record<string, string> = {
    email: payload.email,
    ...(payload.phone ? { phone: payload.phone } : null),
  };
  const { body: multipartBody, boundary } = buildMultipartBody(fields, {
    image_front: {
      bytes: payload.imageFront.bytes,
      contentType: payload.imageFront.contentType,
      filename: `cccd-front.${payload.imageFront.extension}`,
    },
    image_back: {
      bytes: payload.imageBack.bytes,
      contentType: payload.imageBack.contentType,
      filename: `cccd-back.${payload.imageBack.extension}`,
    },
  });

  kycLog('info', 'kyc.provider_request_ready', {
    ...getImageLogFields(payload.imageFront, 'front'),
    ...getImageLogFields(payload.imageBack, 'back'),
    emailAttached: true,
    multipartBodyBytes: multipartBody.byteLength,
    phoneAttached: Boolean(payload.phone),
    providerEndpoint: KYC_PROVIDER_ID_CARD_PATH,
    requestId,
  });

  try {
    response = await fetch(`${getPaymentBaseUrl(env)}${KYC_PROVIDER_ID_CARD_PATH}`, {
      body: multipartBody,
      headers: {
        Accept: 'application/json',
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Partner-App-Key': getPartnerKey(env),
      },
      method: 'POST',
    });
  } catch (error) {
    kycLog('error', 'kyc.provider_network_error', {
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : String(error),
      providerEndpoint: KYC_PROVIDER_ID_CARD_PATH,
      requestId,
    });

    throw makeError('KYC provider is unavailable. Please try again.', 502);
  }

  const text = await response.text();
  let body: KycProviderResponse | null = null;

  try {
    body = text ? (JSON.parse(text) as KycProviderResponse) : null;
  } catch {
    body = null;
  }

  const responseLog = {
    durationMs: Date.now() - startedAt,
    providerContentType: response.headers.get('content-type'),
    providerEndpoint: KYC_PROVIDER_ID_CARD_PATH,
    providerResponseBytes: new TextEncoder().encode(text).byteLength,
    providerStatus: response.status,
    providerTraceId: response.headers.get('x-trace-id'),
    requestId,
    ...getProviderResponseLog(body, text),
  };

  if (!response.ok || !body?.success || !body.data) {
    const message = formatProviderFailure(response.status, body, text);
    const status =
      response.status === 413 ? 413 : response.ok ? 502 : response.status || 502;

    kycLog('error', 'kyc.provider_rejected', responseLog);

    throw makeError(message, status);
  }

  kycLog('info', 'kyc.provider_accepted', responseLog);

  return body.data;
}

export function registerKycRoutes(app: Hono<WorkerBindings>) {
  app.get('/api/kyc/status', async c => {
    const account = await requireAuthenticatedAccount(
      c.env,
      c.req.header('authorization'),
    );

    return c.json({
      data: await getKycSummaryForAccount(c.env, account.email),
      success: true,
    });
  });

  app.post('/api/kyc/id-card', async c => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    let stage = 'request_received';

    c.header('x-kyc-request-id', requestId);
    kycLog('info', 'kyc.request_received', {
      contentLength: c.req.header('content-length') || null,
      contentType: c.req.header('content-type') || null,
      requestId,
    });

    try {
      stage = 'authenticating';
      const account = await requireAuthenticatedAccount(
        c.env,
        c.req.header('authorization'),
      );

      kycLog('info', 'kyc.authenticated', {
        accountId: account.id || null,
        requestId,
      });

      stage = 'reading_body';
      const body = await readJsonBody(c);
      const frontBase64Chars = String(body.imageFrontBase64 || '').length;
      const backBase64Chars = String(body.imageBackBase64 || '').length;

      kycLog('info', 'kyc.body_read', {
        backBase64Chars,
        frontBase64Chars,
        phoneProvided: Boolean(normalizePhone(body.phone)),
        requestId,
      });

      stage = 'decoding_images';
      const imageFront = decodeBase64Image(body.imageFrontBase64);
      const imageBack = decodeBase64Image(body.imageBackBase64);
      const phone = normalizePhone(body.phone);

      if (!imageFront || !imageBack) {
        kycLog('warn', 'kyc.image_decode_failed', {
          backDecoded: Boolean(imageBack),
          frontDecoded: Boolean(imageFront),
          requestId,
        });
        throw makeError('Front and back CCCD images are required', 400);
      }

      kycLog('info', 'kyc.images_decoded', {
        ...getImageLogFields(imageFront, 'front'),
        ...getImageLogFields(imageBack, 'back'),
        requestId,
      });

      stage = 'calling_provider';
      const providerUser = await submitProviderKyc(c.env, requestId, {
        email: account.email,
        imageBack,
        imageFront,
        ...(phone ? { phone } : null),
      });
      const providerUserId = String(providerUser.id || '').trim();
      const idNumber = String(providerUser.id_number || '').replace(/\D/g, '');

      stage = 'saving_kyc';
      kycLog('info', 'kyc.database_save_started', {
        hasDob: Boolean(providerUser.dob),
        hasFullName: Boolean(providerUser.name),
        hasIdNumber: Boolean(idNumber),
        hasPhone: Boolean(providerUser.phone || phone),
        providerUserId: providerUserId || null,
        requestId,
      });

      const record = await saveAccountKyc(c.env, {
        accountEmail: account.email,
        cccdHash: await sha256Hex(idNumber),
        cccdLast4: idNumber ? idNumber.slice(-4) : null,
        dob: providerUser.dob || null,
        fullName: providerUser.name || null,
        phone: providerUser.phone || phone || null,
        providerUserId,
      });

      kycLog('info', 'kyc.completed', {
        durationMs: Date.now() - startedAt,
        providerUserId: record.providerUserId,
        requestId,
        status: record.status,
      });

      return c.json({
        data: {
          cccdLast4: record.cccdLast4 || undefined,
          fullName: record.fullName || undefined,
          phone: record.phone || undefined,
          providerUserId: record.providerUserId,
          status: record.status,
          verifiedAt: record.updatedAt,
        },
        success: true,
      });
    } catch (error) {
      kycLog('error', 'kyc.failed', {
        durationMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : String(error),
        requestId,
        stage,
        status: (error as { status?: number }).status || 500,
      });
      throw error;
    }
  });
}
