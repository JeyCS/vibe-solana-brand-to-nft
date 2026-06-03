export interface GeneratedMascot {
  imageUrl: string;
  prompt: string;
  style: string;
  mimeType: string;
}

export type MintingMode = "real" | "demo";

export interface MintingStatus {
  step: "idle" | "uploading_metadata" | "minting_nft" | "confirming" | "success" | "error";
  message: string;
  txHash?: string;
  mintAddress?: string;
}

export interface SolanaWalletState {
  connected: boolean;
  publicKey: string | null;
  balance: number; // in SOL
}
