import re
import os

def replace_in_file(filepath, pattern, replacement):
    with open(filepath, 'r') as f:
        content = f.read()
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Also add import ExplorerLink if not present
    if 'ExplorerLink' not in content and replacement in content:
        content = re.sub(r"import \{\n(.*?)\n\} from '@components/wallet';", r"import {\n\1,\n  ExplorerLink\n} from '@components/wallet';", content, count=1, flags=re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(content)

# 1. TransactionDetailScreen.tsx
replace_in_file(
    'TransactionDetailScreen.tsx',
    r"<PressScale\s+onPress=\{\(\) => wallet\.openUrl\(transaction\.explorerUrl\)\}\s+style=\{modern\.secondaryModernButton\}\s+>\s+<Text style=\{\[modern\.modernButtonText, modern\.secondaryModernButtonText\]\}>\s+Open on Stellar Expert\s+</Text>\s+</PressScale>",
    r"<ExplorerLink onPress={() => wallet.openUrl(transaction.explorerUrl)} />"
)

# 2. SwapScreen.tsx
replace_in_file(
    'SwapScreen.tsx',
    r"<PressScale\s+onPress=\{\(\) => wallet\.openUrl\(lastSwap\.transaction\.explorerUrl\)\}\s+style=\{modern\.secondaryModernButton\}\s+>\s+<Text style=\{\[modern\.modernButtonText, modern\.secondaryModernButtonText\]\}>\s+Explorer\s+</Text>\s+</PressScale>",
    r"<ExplorerLink onPress={() => wallet.openUrl(lastSwap.transaction.explorerUrl)} />"
)

# 3. SettingsScreen.tsx
replace_in_file(
    'SettingsScreen.tsx',
    r"<TouchableOpacity\s+activeOpacity=\{0\.75\}\s+disabled=\{wallet\.isBusy \|\| !canOpenExplorer\}\s+onPress=\{\(\) => wallet\.openUrl\(wallet\.explorerAddressUrl\)\}\s+style=\{\[\s+styles\.walletAction,\s+wallet\.isBusy \|\| !canOpenExplorer\s+\? styles\.disabledAction\s+: null,\s+\]\}\s+>\s+<View style=\{styles\.walletActionIcon\}>\s+<Ionicons color=\"#3867D6\" name=\"open-outline\" size=\{24\} />\s+</View>\s+<Text style=\{styles\.walletActionText\}>Explorer</Text>\s+</TouchableOpacity>",
    r"<ExplorerLink disabled={wallet.isBusy || !canOpenExplorer} onPress={() => wallet.openUrl(wallet.explorerAddressUrl)} />"
)

# 4. ReceiveScreen.tsx
replace_in_file(
    'ReceiveScreen.tsx',
    r"<PressScale\s+disabled=\{!canOpenExplorer\}\s+onPress=\{\(\) => wallet\.openUrl\(wallet\.explorerAddressUrl\)\}\s+style=\{\[\s+styles\.outlineButton,\s+!canOpenExplorer \? styles\.disabledButton : null,\s+\]\}\s+>\s+<Ionicons color=\"#24495A\" name=\"open-outline\" size=\{18\} />\s+<Text style=\{styles\.outlineButtonText\}>Explorer</Text>\s+</PressScale>",
    r"<ExplorerLink disabled={!canOpenExplorer} onPress={() => wallet.openUrl(wallet.explorerAddressUrl)} />"
)

# 5. FaucetScreen.tsx
replace_in_file(
    'FaucetScreen.tsx',
    r"<PressScale\s+disabled=\{!canOpenExplorer\}\s+onPress=\{\(\) => wallet\.openUrl\(wallet\.explorerAddressUrl\)\}\s+style=\{\[styles\.outlineButton, !canOpenExplorer \? styles\.disabledButton : null\]\}\s+>\s+<Ionicons color=\"#24495A\" name=\"open-outline\" size=\{18\} />\s+<Text style=\{styles\.outlineButtonText\}>Explorer</Text>\s+</PressScale>",
    r"<ExplorerLink disabled={!canOpenExplorer} onPress={() => wallet.openUrl(wallet.explorerAddressUrl)} />"
)

# 6. AssetDetailScreen.tsx
replace_in_file(
    'AssetDetailScreen.tsx',
    r"<PressScale\s+disabled=\{!canOpenExplorer\}\s+onPress=\{\(\) => wallet\.openUrl\(assetExplorerUrl\)\}\s+style=\{styles\.explorerButton\}\s+>\s+<Ionicons color=\"#0F8EA3\" name=\"open-outline\" size=\{18\} />\s+<Text style=\{styles\.explorerText\}>Open explorer</Text>\s+</PressScale>",
    r"<ExplorerLink disabled={!canOpenExplorer} onPress={() => wallet.openUrl(assetExplorerUrl)} />"
)

# 7. SendScreen.tsx
replace_in_file(
    'SendScreen.tsx',
    r"<PressScale\s+onPress=\{\(\) => wallet\.openUrl\(lastResult\.transaction\.explorerUrl\)\}\s+style=\{modern\.secondaryModernButton\}\s+>\s+<Text style=\{\[modern\.modernButtonText, modern\.secondaryModernButtonText\]\}>\s+Explorer\s+</Text>\s+</PressScale>",
    r"<ExplorerLink onPress={() => wallet.openUrl(lastResult.transaction.explorerUrl)} />"
)

