import { useMemo } from "react";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys";
import { useWallet } from "@solana/wallet-adapter-react";

export const useUmi = () => {
  const wallet = useWallet();
  // Using public Solana Devnet node
  const endpoint = "https://api.devnet.solana.com";

  const umi = useMemo(() => {
    const u = createUmi(endpoint)
      .use(mplTokenMetadata())
      .use(irysUploader({ address: "https://devnet.irys.xyz" }));
    
    return u;
  }, [endpoint]);

  useMemo(() => {
    if (wallet && wallet.publicKey) {
      umi.use(walletAdapterIdentity(wallet));
    }
  }, [umi, wallet]);

  return umi;
};
