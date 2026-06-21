import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type AppPopupVariant = 'danger' | 'info' | 'success' | 'warning';

export type AppPopupAction = {
  onPress?: () => void | Promise<unknown>;
  style?: 'cancel' | 'default' | 'destructive';
  text: string;
};

export type AppPopupOptions = {
  actions?: AppPopupAction[];
  dismissOnBackdrop?: boolean;
  message?: string;
  title: string;
  variant?: AppPopupVariant;
};

type AppPopupContextValue = {
  hidePopup: () => void;
  showPopup: (options: AppPopupOptions) => void;
};

type AppPopupProps = AppPopupOptions & {
  onDismiss: () => void;
  visible: boolean;
};

const AppPopupContext = createContext<AppPopupContextValue | null>(null);

const VARIANT_META: Record<
  AppPopupVariant,
  { color: string; icon: string; iconBg: string }
> = {
  danger: {
    color: '#FF6B7A',
    icon: 'alert-circle',
    iconBg: 'rgba(255, 107, 122, 0.14)',
  },
  info: {
    color: '#66D9EF',
    icon: 'information-circle',
    iconBg: 'rgba(102, 217, 239, 0.14)',
  },
  success: {
    color: '#B8FF45',
    icon: 'checkmark-circle',
    iconBg: 'rgba(184, 255, 69, 0.14)',
  },
  warning: {
    color: '#FFD166',
    icon: 'warning',
    iconBg: 'rgba(255, 209, 102, 0.14)',
  },
};

function getActionStyle(action: AppPopupAction, index: number, total: number) {
  if (action.style === 'destructive') {
    return [styles.actionButton, styles.destructiveButton];
  }

  if (action.style === 'cancel' || (total > 1 && index === 0)) {
    return [styles.actionButton, styles.secondaryButton];
  }

  return [styles.actionButton, styles.primaryButton];
}

function getActionTextStyle(action: AppPopupAction, index: number, total: number) {
  if (action.style === 'destructive') {
    return [styles.actionText, styles.destructiveText];
  }

  if (action.style === 'cancel' || (total > 1 && index === 0)) {
    return [styles.actionText, styles.secondaryText];
  }

  return [styles.actionText, styles.primaryText];
}

export function AppPopup({
  actions,
  dismissOnBackdrop = true,
  message,
  onDismiss,
  title,
  variant = 'info',
  visible,
}: AppPopupProps) {
  const meta = VARIANT_META[variant];
  const popupActions =
    actions && actions.length > 0 ? actions : [{ text: 'OK' }];

  function handleActionPress(action: AppPopupAction) {
    onDismiss();
    action.onPress?.();
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityRole="button"
          disabled={!dismissOnBackdrop}
          onPress={onDismiss}
          style={styles.backdrop}
        >
          <Pressable accessibilityViewIsModal style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: meta.iconBg }]}>
              <Ionicons color={meta.color} name={meta.icon} size={34} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {message ? <Text style={styles.message}>{message}</Text> : null}
            <View
              style={[
                styles.actions,
                popupActions.length > 1 ? styles.actionsRow : null,
              ]}
            >
              {popupActions.map((action, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${action.text}-${index}`}
                  onPress={() => handleActionPress(action)}
                  style={({ pressed }) => [
                    getActionStyle(action, index, popupActions.length),
                    pressed ? styles.buttonPressed : null,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.78}
                    style={getActionTextStyle(
                      action,
                      index,
                      popupActions.length,
                    )}
                  >
                    {action.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </View>
    </Modal>
  );
}

export function AppPopupProvider({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<AppPopupOptions | null>(null);

  const hidePopup = useCallback(() => {
    setPopup(null);
  }, []);

  const showPopup = useCallback((options: AppPopupOptions) => {
    setPopup(options);
  }, []);

  const value = useMemo(
    () => ({
      hidePopup,
      showPopup,
    }),
    [hidePopup, showPopup],
  );

  return (
    <AppPopupContext.Provider value={value}>
      {children}
      <AppPopup
        actions={popup?.actions}
        dismissOnBackdrop={popup?.dismissOnBackdrop}
        message={popup?.message}
        onDismiss={hidePopup}
        title={popup?.title || ''}
        variant={popup?.variant}
        visible={Boolean(popup)}
      />
    </AppPopupContext.Provider>
  );
}

export function useAppPopup() {
  const value = useContext(AppPopupContext);

  if (!value) {
    throw new Error('useAppPopup must be used inside AppPopupProvider');
  }

  return value;
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 22,
  },
  actionsRow: {
    flexDirection: 'row',
  },
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.66)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#10141A',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 28,
    borderWidth: 1,
    maxWidth: 360,
    padding: 22,
    shadowColor: '#000000',
    shadowOffset: { height: 18, width: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    width: '100%',
  },
  destructiveButton: {
    backgroundColor: 'rgba(255, 107, 122, 0.14)',
    borderColor: 'rgba(255, 107, 122, 0.24)',
    borderWidth: 1,
  },
  destructiveText: {
    color: '#FF7A88',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 23,
    height: 54,
    justifyContent: 'center',
    marginBottom: 14,
    width: 54,
  },
  message: {
    color: '#D5DEE5',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#B8FF45',
  },
  primaryText: {
    color: '#07100B',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1,
  },
  secondaryText: {
    color: '#FFFFFF',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 26,
    textAlign: 'center',
  },
});
