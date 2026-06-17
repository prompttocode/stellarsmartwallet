import re

with open('walletExportPage.ts', 'r') as f:
    content = f.read()

new_head = """  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1"
    />
    <title>Privy Recovery Export</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      :root {
        color-scheme: dark;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 50% -20%, rgba(184, 255, 69, 0.12), #050505 60%);
        background-attachment: fixed;
        color: #FFFFFF;
      }

      button,
      input {
        font: inherit;
      }

      button {
        cursor: pointer;
      }

      #root {
        min-height: 100vh;
      }

      .shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
      }

      .card {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        padding: 32px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        background: rgba(17, 19, 24, 0.7);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        box-shadow: 0 40px 100px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .eyebrow {
        display: inline-flex;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(184, 255, 69, 0.15);
        color: #B8FF45;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        border: 1px solid rgba(184, 255, 69, 0.3);
        box-shadow: 0 0 20px rgba(184, 255, 69, 0.2);
      }

      h1 {
        margin: 20px 0 12px;
        font-size: 32px;
        font-weight: 800;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }

      p {
        margin: 0;
        color: #a0aec0;
        line-height: 1.6;
        font-size: 16px;
      }

      .stack {
        display: grid;
        gap: 16px;
        margin-top: 32px;
      }

      .info {
        padding: 16px 20px;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.3s ease;
      }

      .info:hover {
        background: rgba(255, 255, 255, 0.05);
      }

      .label {
        margin-bottom: 6px;
        color: #718096;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .value {
        word-break: break-word;
        color: #ffffff;
        font-size: 15px;
        font-weight: 500;
      }

      .actions {
        display: grid;
        gap: 14px;
        margin-top: 36px;
      }

      .primary,
      .secondary {
        width: 100%;
        padding: 16px;
        border-radius: 16px;
        border: 0;
        font-weight: 700;
        font-size: 16px;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .primary {
        background: linear-gradient(135deg, #B8FF45, #95E01D);
        color: #000000;
        box-shadow: 0 4px 15px rgba(184, 255, 69, 0.2);
      }

      .primary:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(184, 255, 69, 0.4);
      }

      .primary:active:not(:disabled) {
        transform: translateY(0);
      }

      .primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .secondary {
        background: #2C2C2E;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }

      .secondary:hover {
        background: #3A3A3C;
        transform: translateY(-1px);
      }

      .status {
        min-height: 22px;
        font-size: 14px;
        margin-top: 16px;
        text-align: center;
        font-weight: 500;
      }

      .status.error {
        color: #ffb4b4;
      }

      .status.success {
        color: #98efba;
      }

      .status.warning {
        color: #ffd58a;
      }
    </style>
  </head>"""

content = re.sub(r'  <head>.*?</head>', new_head, content, flags=re.DOTALL)

with open('walletExportPage.ts', 'w') as f:
    f.write(content)
