import re

with open('SendScreen.tsx', 'r') as f:
    content = f.read()

# Remove SectionHeader from imports
content = content.replace("  SectionHeader,\n", "")

# Add LocalSectionHeader and LocalAssetSelectButton definitions
local_components = """
function LocalSectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

function LocalAssetSelectButton({ asset, label, onPress, valueLabel }: any) {
  return (
    <PressScale onPress={onPress} style={styles.assetSelectButton}>
      <TokenIcon assetCode={asset?.assetCode} imageUrl={asset?.image} size={42} />
      <View style={styles.assetSelectCopy}>
        <Text style={styles.assetSelectLabel}>{label}</Text>
        <Text style={styles.assetSelectTitle}>{asset?.assetCode || 'Select'}</Text>
        <Text style={styles.assetSelectSubtitle}>
          {asset?.assetIssuer ? 'Custom asset' : 'Lumens'} · Balance {valueLabel.split(' ')[0]}
        </Text>
      </View>
      <View style={styles.assetSelectTrailing}>
        <Text style={styles.assetSelectValue}>{valueLabel}</Text>
        <Text style={styles.assetSelectFiat}>≈ $0.00</Text>
        <Ionicons color="#6C757D" name="chevron-down" size={16} style={{ alignSelf: 'flex-end', marginTop: 4 }} />
      </View>
    </PressScale>
  );
}
"""

# Insert local components before `export function SendScreen`
content = content.replace("export function SendScreen", "import { TokenIcon } from '@components/wallet';\n" + local_components + "\nexport function SendScreen")

# Replace <SectionHeader with <LocalSectionHeader
content = content.replace("<SectionHeader", "<LocalSectionHeader")
content = content.replace("</SectionHeader>", "</LocalSectionHeader>")

# Replace <AssetSelectButton with <LocalAssetSelectButton
content = content.replace("<AssetSelectButton", "<LocalAssetSelectButton")

# Add styles for these local components
styles_addition = """
  assetSelectButton: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 20,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  assetSelectCopy: {
    flex: 1,
    gap: 2,
  },
  assetSelectLabel: {
    color: '#8A9099',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  assetSelectTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  assetSelectSubtitle: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '600',
  },
  assetSelectTrailing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  assetSelectValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  assetSelectFiat: {
    color: '#8A9099',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '900',
  },
"""

content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + styles_addition)

with open('SendScreen.tsx', 'w') as f:
    f.write(content)

