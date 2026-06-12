import re
with open('RampScreen.tsx', 'r') as f:
    content = f.read()

content = re.sub(
    r"<Pressable\s+accessibilityRole=\"button\"\s+onPress=\{\(\) => wallet\.openUrl\(explorerUrl\)\}\s+style=\{\(\{ pressed \}\) => \[\s+styles\.resultSecondaryAction,\s+pressed \? styles\.resultSecondaryActionPressed : null,\s+\]\}\s+>\s+<Text style=\{styles\.resultSecondaryActionText\}>Explorer</Text>\s+</Pressable>",
    r"<ExplorerLink onPress={() => wallet.openUrl(explorerUrl)} />",
    content,
    flags=re.DOTALL
)

with open('RampScreen.tsx', 'w') as f:
    f.write(content)
