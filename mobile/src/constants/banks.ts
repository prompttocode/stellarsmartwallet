import type { ImageSourcePropType } from 'react-native';

export type BankOption = {
  bin: string;
  image: ImageSourcePropType;
  name: string;
};

export const BANK_OPTIONS: readonly BankOption[] = [
  {
    bin: '970422',
    image: require('@assets/banks/mb.png'),
    name: 'MB Bank',
  },
  {
    bin: '970436',
    image: require('@assets/banks/vietcombank.png'),
    name: 'Vietcombank',
  },
  {
    bin: '970416',
    image: require('@assets/banks/ACB-970416.png'),
    name: 'ACB',
  },
  {
    bin: '970405',
    image: require('@assets/banks/Agribank-970405.png'),
    name: 'Agribank',
  },
  {
    bin: '970418',
    image: require('@assets/banks/BIDV-970418.png'),
    name: 'BIDV',
  },
  {
    bin: '970449',
    image: require('@assets/banks/LPBank-970449.png'),
    name: 'LPBank',
  },
  {
    bin: '970403',
    image: require('@assets/banks/Sacombank-970403.png'),
    name: 'Sacombank',
  },
  {
    bin: '970440',
    image: require('@assets/banks/SeABank-970440.png'),
    name: 'SeABank',
  },
  {
    bin: '970423',
    image: require('@assets/banks/TPBank-970423.png'),
    name: 'TPBank',
  },
  {
    bin: '970407',
    image: require('@assets/banks/Techcombank-970407.png'),
    name: 'Techcombank',
  },
  {
    bin: '970441',
    image: require('@assets/banks/VIB-970441.png'),
    name: 'VIB',
  },
  {
    bin: '970432',
    image: require('@assets/banks/VPBank-970432.png'),
    name: 'VPBank',
  },
  {
    bin: '970415',
    image: require('@assets/banks/VietinBank-970415.png'),
    name: 'VietinBank',
  },
];
