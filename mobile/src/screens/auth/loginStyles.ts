import { StyleSheet } from 'react-native';

export const loginStyles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#050505',
  },
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  
  // Header / Top icon
  topIconContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Graphic
  graphicContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 250,
  },
  graphicImage: {
    width: '100%',
    height: 250,
    opacity: 0.8,
  },

  // Welcome Text
  welcomeTextContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  welcomeTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  welcomeSubtitle: {
    color: '#8E8E93',
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  sessionStatusBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(184, 255, 69, 0.08)',
    borderColor: 'rgba(184, 255, 69, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    maxWidth: 320,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sessionStatusAnimation: {
    height: 34,
    width: 44,
  },
  sessionStatusCopy: {
    flex: 1,
    gap: 2,
  },
  sessionStatusText: {
    color: '#8E8E93',
    fontSize: 12,
    lineHeight: 16,
  },
  sessionStatusTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Buttons
  buttonContainer: {
    gap: 16,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    width: '100%',
    gap: 10,
  },
  actionButtonLight: {
    backgroundColor: '#FFFFFF',
  },
  actionButtonDark: {
    backgroundColor: '#2C2C2E',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionButtonTextLight: {
    color: '#000000',
  },
  actionButtonTextDark: {
    color: '#FFFFFF',
  },
  actionButtonTextDisabled: {},
  googleIcon: {
    width: 20,
    height: 20,
  },

  // Footer
  footerContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  footerText: {
    color: '#636366',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLink: {
    textDecorationLine: 'underline',
    color: '#8E8E93',
  },

  // Form Container (for email/otp)
  formContainer: {
    flex: 1,
    gap: 20,
  },
  input: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    color: '#FFFFFF',
    fontSize: 17,
    height: 56,
    paddingHorizontal: 20,
    width: '100%',
  },
  
  // OTP
  otpWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  otpHiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },
  otpCell: {
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    width: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  otpCellFilled: {
    borderColor: '#3A3A3C',
  },
  otpCellActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2C2C2E',
  },
  otpDigit: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
  },

  // Links
  linkRow: {
    alignItems: 'center',
    marginTop: 10,
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  textButtonText: {
    color: '#8E8E93',
    fontSize: 15,
    fontWeight: '500',
  },

  // Error
  messageBox: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  errorText: {
    color: '#FF453A',
    fontSize: 14,
  },
});
