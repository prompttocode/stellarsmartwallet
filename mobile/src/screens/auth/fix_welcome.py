import re

with open('LoginScreen.tsx', 'r') as f:
    content = f.read()

# Replace WelcomeStep completely
new_welcome_step = """function WelcomeStep({ wallet, onSelectEmail }: { wallet: WalletState, onSelectEmail: () => void }) {
  const googleBusy = wallet.busy === 'Sign in with Google';

  return (
    <View style={styles.stepContainer}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ marginBottom: 40 }}>
          <Ionicons name="planet" size={32} color="#FFFFFF" />
        </View>

        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <Text style={styles.welcomeTitle}>Welcome</Text>
          <Text style={styles.welcomeSubtitle}>Your journey starts from here</Text>
        </View>
      </View>

      <View>
        <View style={styles.buttonContainer}>
          <ActionButton 
            label="Continue with Email" 
            onPress={onSelectEmail} 
            variant="light" 
          />
          <GoogleButton
            disabled={!wallet.isReady || wallet.isBusy}
            label={googleBusy ? 'Opening Google...' : 'Continue with Google'}
            onPress={wallet.loginWithGoogle}
          />
        </View>

        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            By pressing on "Continue with..." you agree{`\\n`}to our <Text style={styles.footerLink}>Terms of Service</Text> and <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}"""

content = re.sub(
    r"function WelcomeStep.*?\n}\n", 
    new_welcome_step + "\n", 
    content, 
    flags=re.DOTALL
)

with open('LoginScreen.tsx', 'w') as f:
    f.write(content)
