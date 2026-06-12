import React from 'react';
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useWalletConnect,
  type WalletConnectAssetReview,
  type WalletConnectOperationReview,
} from '@contexts/WalletConnectContext';
import type { WalletState } from '@hooks/useWallet';
import { shortAddress } from '@utils/format';

function assetLabel(asset?: WalletConnectAssetReview | null) {
  if (!asset) {
    return '-';
  }

  return asset.issuer
    ? `${asset.code} · ${shortAddress(asset.issuer)}`
    : asset.code;
}

function operationTitle(operation: WalletConnectOperationReview) {
  switch (operation.type) {
    case 'payment':
      return 'Send payment';
    case 'createAccount':
      return 'Create Stellar account';
    case 'changeTrust':
      return Number(operation.limit) === 0
        ? 'Remove asset trustline'
        : 'Enable asset trustline';
    case 'pathPaymentStrictSend':
    case 'pathPaymentStrictReceive':
      return 'Swap with path payment';
    case 'manageBuyOffer':
      return 'Manage buy offer';
    case 'manageSellOffer':
      return 'Manage sell offer';
    case 'createPassiveSellOffer':
      return 'Create passive sell offer';
    default:
      return operation.type;
  }
}

function operationRows(operation: WalletConnectOperationReview) {
  switch (operation.type) {
    case 'payment':
      return [
        ['Amount', `${operation.amount} ${assetLabel(operation.asset)}`],
        ['To', shortAddress(operation.destination)],
      ];
    case 'createAccount':
      return [
        ['Starting balance', `${operation.startingBalance} XLM`],
        ['New account', shortAddress(operation.destination)],
      ];
    case 'changeTrust':
      return [
        ['Asset', assetLabel(operation.asset)],
        ['Limit', operation.limit || '-'],
      ];
    case 'pathPaymentStrictSend':
      return [
        ['Send', `${operation.sendAmount} ${assetLabel(operation.sendAsset)}`],
        [
          'Minimum receive',
          `${operation.destinationMinimum} ${assetLabel(
            operation.destinationAsset,
          )}`,
        ],
        ['To', shortAddress(operation.destination)],
      ];
    case 'pathPaymentStrictReceive':
      return [
        [
          'Receive',
          `${operation.destinationAmount} ${assetLabel(
            operation.destinationAsset,
          )}`,
        ],
        [
          'Maximum send',
          `${operation.sendMaximum} ${assetLabel(operation.sendAsset)}`,
        ],
        ['To', shortAddress(operation.destination)],
      ];
    case 'manageBuyOffer':
      return [
        ['Buy', `${operation.buyAmount} ${assetLabel(operation.buying)}`],
        ['Sell asset', assetLabel(operation.selling)],
        ['Price', operation.price || '-'],
        ['Offer ID', operation.offerId || 'New offer'],
      ];
    case 'manageSellOffer':
    case 'createPassiveSellOffer':
      return [
        ['Sell', `${operation.amount} ${assetLabel(operation.selling)}`],
        ['Buy asset', assetLabel(operation.buying)],
        ['Price', operation.price || '-'],
        ['Offer ID', operation.offerId || 'New offer'],
      ];
    default:
      return [];
  }
}

function DappIdentity({
  icon,
  name,
  url,
}: {
  icon: string | null;
  name: string;
  url: string;
}) {
  return (
    <View style={styles.dappIdentity}>
      <View style={styles.dappIcon}>
        {icon ? (
          <Image source={{ uri: icon }} style={styles.dappImage} />
        ) : (
          <Ionicons color="#FFFFFF" name="link" size={24} />
        )}
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.dappName}>
          {name}
        </Text>
        <Text numberOfLines={1} style={styles.dappUrl}>
          {url || 'WalletConnect dApp'}
        </Text>
      </View>
    </View>
  );
}

function ActionButtons({
  approveDisabled,
  approveLabel,
  onApprove,
  onReject,
}: {
  approveDisabled?: boolean;
  approveLabel: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onReject}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryButtonText}>Reject</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={approveDisabled}
        onPress={onApprove}
        style={[
          styles.primaryButton,
          approveDisabled ? styles.buttonDisabled : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>{approveLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function WalletConnectOverlays({ wallet }: { wallet: WalletState }) {
  const insets = useSafeAreaInsets();
  const walletConnect = useWalletConnect();
  const proposal = walletConnect.proposal;
  const request = walletConnect.request;
  const result = walletConnect.result;

  return (
    <>
      <Modal
        animationType="fade"
        onRequestClose={() => walletConnect.rejectProposal()}
        transparent
        visible={Boolean(proposal)}
      >
        <View style={styles.overlay}>
          <View style={styles.proposalCard}>
            <View style={styles.handle} />
            <Text style={styles.eyebrow}>CONNECTION REQUEST</Text>
            <Text style={styles.title}>Connect this dApp?</Text>
            {proposal ? (
              <>
                <DappIdentity
                  icon={proposal.icon}
                  name={proposal.name}
                  url={proposal.url}
                />
                <View style={styles.summaryBox}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Network</Text>
                    <Text style={styles.summaryValue}>
                      {wallet.isMainnet ? 'Stellar Mainnet' : 'Stellar Testnet'}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Wallet</Text>
                    <Text style={styles.summaryValue}>
                      {shortAddress(wallet.wallet?.address)}
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Permissions</Text>
                    <Text style={styles.summaryValue}>
                      Request transaction signatures
                    </Text>
                  </View>
                </View>
                <Text style={styles.helper}>
                  This dApp can view your public address and request signatures.
                  It cannot access your private key or approve transactions by
                  itself.
                </Text>
                <ActionButtons
                  approveLabel="Connect"
                  onApprove={() => walletConnect.approveProposal()}
                  onReject={() => walletConnect.rejectProposal()}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => walletConnect.rejectRequest()}
        visible={Boolean(request)}
      >
        <View style={styles.requestScreen}>
          <View
            style={[
              styles.requestHeader,
              { paddingTop: Math.max(insets.top, 16) },
            ]}
          >
            <TouchableOpacity
              onPress={() => walletConnect.rejectRequest()}
              style={styles.closeButton}
            >
              <Ionicons color="#FFFFFF" name="close" size={22} />
            </TouchableOpacity>
            <Text style={styles.requestHeaderTitle}>Review transaction</Text>
            <View style={styles.closeSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.requestContent,
              { paddingBottom: Math.max(insets.bottom, 20) + 120 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {request ? (
              <>
                <DappIdentity
                  icon={request.peerIcon}
                  name={request.peerName}
                  url={request.peerUrl}
                />

                <View
                  style={[
                    styles.networkNotice,
                    wallet.isMainnet ? styles.mainnetNotice : null,
                  ]}
                >
                  <Ionicons
                    color={wallet.isMainnet ? '#A64B13' : '#3768B8'}
                    name={
                      wallet.isMainnet
                        ? 'alert-circle-outline'
                        : 'flask-outline'
                    }
                    size={19}
                  />
                  <Text
                    style={[
                      styles.networkNoticeText,
                      wallet.isMainnet ? styles.mainnetNoticeText : null,
                    ]}
                  >
                    {wallet.isMainnet
                      ? 'Mainnet transaction using real assets'
                      : 'Testnet transaction using demo assets'}
                  </Text>
                </View>

                {request.reviewing ? (
                  <View style={styles.reviewState}>
                    <Ionicons
                      color="#6E7681"
                      name="hourglass-outline"
                      size={28}
                    />
                    <Text style={styles.reviewStateTitle}>
                      Checking transaction
                    </Text>
                    <Text style={styles.reviewStateText}>
                      The Worker is decoding the Stellar XDR before signing.
                    </Text>
                  </View>
                ) : request.reviewError ? (
                  <View style={styles.errorBox}>
                    <Ionicons
                      color="#B63C43"
                      name="close-circle-outline"
                      size={25}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.errorTitle}>Transaction blocked</Text>
                      <Text style={styles.errorText}>
                        {request.reviewError}
                      </Text>
                    </View>
                  </View>
                ) : request.review ? (
                  <>
                    <View style={styles.transactionSummary}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Request</Text>
                        <Text style={styles.summaryValue}>
                          {request.method === 'stellar_signAndSubmitXDR'
                            ? 'Sign and submit'
                            : 'Sign only'}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Source</Text>
                        <Text style={styles.summaryValue}>
                          {shortAddress(request.review.source)}
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Network fee</Text>
                        <Text style={styles.summaryValue}>
                          {request.review.fee} stroops
                        </Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Memo</Text>
                        <Text style={styles.summaryValue}>
                          {request.review.memo || 'None'}
                        </Text>
                      </View>
                    </View>

                    {request.review.warnings.map(warning => (
                      <View key={warning} style={styles.warningBox}>
                        <Ionicons
                          color="#9A641B"
                          name="warning-outline"
                          size={19}
                        />
                        <Text style={styles.warningText}>{warning}</Text>
                      </View>
                    ))}

                    <Text style={styles.sectionTitle}>
                      Operations ({request.review.operationCount})
                    </Text>
                    {request.review.operations.map((operation, index) => (
                      <View
                        key={`${operation.type}:${index}`}
                        style={styles.operationCard}
                      >
                        <View style={styles.operationHeader}>
                          <View style={styles.operationNumber}>
                            <Text style={styles.operationNumberText}>
                              {index + 1}
                            </Text>
                          </View>
                          <Text style={styles.operationTitle}>
                            {operationTitle(operation)}
                          </Text>
                        </View>
                        {operationRows(operation).map(([label, value]) => (
                          <View key={label} style={styles.operationRow}>
                            <Text style={styles.operationLabel}>{label}</Text>
                            <Text
                              numberOfLines={2}
                              style={styles.operationValue}
                            >
                              {value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.requestActions,
              { paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <ActionButtons
              approveDisabled={!request?.review}
              approveLabel={wallet.isMainnet ? 'Approve' : 'Approve'}
              onApprove={() => walletConnect.approveRequest()}
              onReject={() => walletConnect.rejectRequest()}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={walletConnect.clearResult}
        transparent
        visible={Boolean(result)}
      >
        <View style={styles.overlay}>
          <View style={styles.resultCard}>
            <View style={styles.resultIcon}>
              <Ionicons color="#FFFFFF" name="checkmark" size={28} />
            </View>
            <Text style={styles.resultTitle}>Request approved</Text>
            <Text style={styles.resultText}>
              {result?.method === 'stellar_signAndSubmitXDR'
                ? `The transaction from ${result.peerName} was submitted to Stellar.`
                : `The signed XDR was returned to ${result?.peerName}.`}
            </Text>
            {result?.hash ? (
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    `https://stellar.expert/explorer/${
                      wallet.isMainnet ? 'public' : 'testnet'
                    }/tx/${result.hash}`,
                  )
                }
                style={styles.explorerButton}
              >
                <Text style={styles.explorerButtonText}>View transaction</Text>
                <Ionicons color="#1D5FC7" name="open-outline" size={17} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={walletConnect.clearResult}
              style={styles.doneButton}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  buttonDisabled: {
    opacity: 0.38,
  },
  closeButton: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  closeSpacer: {
    width: 40,
  },
  dappIcon: {
    alignItems: 'center',
    backgroundColor: '#15181E',
    borderRadius: 17,
    height: 54,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 54,
  },
  dappIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 13,
    marginTop: 20,
  },
  dappImage: {
    height: 54,
    width: 54,
  },
  dappName: {
    color: '#171B22',
    fontSize: 17,
    fontWeight: '800',
  },
  dappUrl: {
    color: '#858B94',
    fontSize: 12,
    marginTop: 3,
  },
  doneButton: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 16,
    marginTop: 18,
    minHeight: 52,
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  errorBox: {
    backgroundColor: '#FFF1F1',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 11,
    marginTop: 18,
    padding: 16,
  },
  errorText: {
    color: '#8D454A',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  errorTitle: {
    color: '#8F3037',
    fontSize: 15,
    fontWeight: '800',
  },
  explorerButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 18,
  },
  explorerButtonText: {
    color: '#1D5FC7',
    fontSize: 14,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#7E858F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 12,
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#D7DADE',
    borderRadius: 3,
    height: 5,
    width: 42,
  },
  helper: {
    color: '#747B85',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 15,
    textAlign: 'center',
  },
  mainnetNotice: {
    backgroundColor: '#FFF2E8',
  },
  mainnetNoticeText: {
    color: '#8D481D',
  },
  networkNotice: {
    alignItems: 'center',
    backgroundColor: '#ECF3FF',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    marginTop: 18,
    padding: 13,
  },
  networkNoticeText: {
    color: '#315E9E',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  operationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E8EBEF',
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    marginBottom: 12,
    padding: 16,
  },
  operationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 3,
  },
  operationLabel: {
    color: '#858B94',
    fontSize: 12,
  },
  operationNumber: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  operationNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  operationRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  operationTitle: {
    color: '#1B2027',
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  operationValue: {
    color: '#252A31',
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(11, 14, 20, 0.48)',
    flex: 1,
    justifyContent: 'center',
    padding: 22,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#111318',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  proposalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    maxWidth: 430,
    padding: 22,
    width: '100%',
  },
  requestActions: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#ECEEF1',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingHorizontal: 18,
    paddingTop: 13,
    position: 'absolute',
    right: 0,
  },
  requestContent: {
    padding: 18,
  },
  requestHeader: {
    alignItems: 'center',
    backgroundColor: '#071421',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 17,
    paddingHorizontal: 18,
  },
  requestHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  requestScreen: {
    backgroundColor: '#F5F6F8',
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    maxWidth: 390,
    padding: 25,
    width: '100%',
  },
  resultIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#141A21',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  resultText: {
    color: '#747B85',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  resultTitle: {
    color: '#171B22',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 17,
    textAlign: 'center',
  },
  reviewState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginTop: 18,
    padding: 28,
  },
  reviewStateText: {
    color: '#858B94',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'center',
  },
  reviewStateTitle: {
    color: '#242930',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#EEF0F2',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryButtonText: {
    color: '#30353C',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    color: '#1C2027',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 12,
    marginTop: 22,
  },
  summaryBox: {
    backgroundColor: '#F5F6F8',
    borderRadius: 18,
    gap: 12,
    marginTop: 20,
    padding: 15,
  },
  summaryLabel: {
    color: '#858B94',
    fontSize: 12,
  },
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryValue: {
    color: '#242930',
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  title: {
    color: '#171B22',
    fontSize: 23,
    fontWeight: '900',
    marginTop: 7,
    textAlign: 'center',
  },
  transactionSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    gap: 12,
    marginTop: 18,
    padding: 16,
  },
  warningBox: {
    backgroundColor: '#FFF8E8',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    padding: 13,
  },
  warningText: {
    color: '#80591D',
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
