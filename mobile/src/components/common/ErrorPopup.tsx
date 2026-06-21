import React from 'react';
import { AppPopup } from './AppPopup';

interface ErrorPopupProps {
  message?: string;
  onDismiss: () => void;
  title?: string;
  visible: boolean;
}

export function ErrorPopup({
  message,
  onDismiss,
  title = 'Something went wrong',
  visible,
}: ErrorPopupProps) {
  return (
    <AppPopup
      message={message || 'Please try again.'}
      onDismiss={onDismiss}
      title={title}
      variant="danger"
      visible={visible}
    />
  );
}
