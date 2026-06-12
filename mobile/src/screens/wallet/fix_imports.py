import re

files = ['AssetDetailScreen.tsx', 'TransactionDetailScreen.tsx']

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    if 'ExplorerLink' not in content:
        # Just find the import { ... } from '@components/wallet' and inject ExplorerLink
        content = re.sub(r"import \{\n(.*?)\n\} from '@components/wallet';", r"import {\n\1,\n  ExplorerLink\n} from '@components/wallet';", content, count=1, flags=re.DOTALL)
        
        with open(file, 'w') as f:
            f.write(content)

