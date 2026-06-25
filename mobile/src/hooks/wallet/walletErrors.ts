import { useCallback, useState } from 'react';
import { getErrorMessage } from '@utils/format';

export type RunOptions = {
  showAlert?: boolean;
  showBusy?: boolean;
};

export type ErrorDialogState = {
  message: string;
  title: string;
};

export function useWalletErrors(initialMessage: string) {
  const [busy, setBusy] = useState<string | null>(null);
  const [errorDialog, setErrorDialog] = useState<ErrorDialogState | null>(
    null,
  );
  const [message, setMessage] = useState(initialMessage);

  const dismissErrorDialog = useCallback(() => {
    setErrorDialog(null);
  }, []);

  const showErrorDialog = useCallback((messageText: string, title = 'Error') => {
    setErrorDialog({
      message: messageText,
      title,
    });
  }, []);

  const run = useCallback(
    async <T>(
      label: string,
      action: () => Promise<T>,
      options: RunOptions = {},
    ) => {
      const showBusy = options.showBusy !== false;

      try {
        if (showBusy) {
          setBusy(label);
        }

        if (options.showAlert !== false) {
          setErrorDialog(null);
        }

        return await action();
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setMessage(errorMessage);

        if (options.showAlert !== false) {
          if (showBusy) {
            setBusy(null);
          }

          setErrorDialog({
            message: errorMessage,
            title: 'Error',
          });
        }

        return null;
      } finally {
        if (showBusy) {
          setBusy(null);
        }
      }
    },
    [],
  );

  return {
    busy,
    dismissErrorDialog,
    errorDialog,
    message,
    run,
    setBusy,
    setErrorDialog,
    setMessage,
    showErrorDialog,
  };
}
