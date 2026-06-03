import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion, AnimatePresence } from "motion/react";
import { useUmi } from "./hooks/useUmi";
import { percentAmount, generateSigner, createGenericFile } from "@metaplex-foundation/umi";
import { createNft } from "@metaplex-foundation/mpl-token-metadata";
import {
  Sparkles,
  Wallet,
  Coins,
  Layers,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  History,
  Clock,
  Image as ImageIcon,
  Info,
  HelpCircle,
  Cpu
} from "lucide-react";
import { GeneratedMascot, MintingMode, MintingStatus } from "./types";

export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const umi = useUmi();

  // Prompt states
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("mascot-logo");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMascot, setGeneratedMascot] = useState<GeneratedMascot | null>(null);

  // Minting states
  const [mintingMode, setMintingMode] = useState<MintingMode>("demo");
  const [mintStatus, setMintStatus] = useState<MintingStatus>({
    step: "idle",
    message: ""
  });

  // Wallet metadata states
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<Array<GeneratedMascot & { minted: boolean; date: string; address?: string }>>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Faucet state helper
  const [requestingAirdrop, setRequestingAirdrop] = useState(false);

  // Preset Prompts for creative ideas
  const presetPrompts = [
    {
      label: "Cyberpunk Otter",
      style: "mascot-logo",
      text: "A futuristic cyberpunk river otter wearing violet neon visor glasses, game character design, clean vector art"
    },
    {
      label: "Solana SolMascot",
      style: "mascot-logo",
      text: "Cute playful chameleon sitting on a Solana icon, brand mascot, futuristic tech style, vibrant gradients"
    },
    {
      label: "Solana Warrior Shield",
      style: "mascot-logo",
      text: "Majestic neon eagle logo emerging from a dark polygon shield, gaming mascot logo, high electric neon colors"
    },
    {
      label: "Retro Pixel Doge",
      style: "pixel-art2",
      text: "Cool pixelated shiba inu dog wearing gold chain and developer headset, 16-bit cute startup character"
    }
  ];

  // Load and Save local storage history
  useEffect(() => {
    const saved = localStorage.getItem("ai_brand_nft_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const saveHistory = (newHistory: typeof history) => {
    setHistory(newHistory);
    localStorage.setItem("ai_brand_nft_history", JSON.stringify(newHistory));
  };

  // Fetch Wallet Balance inside Solana Devnet
  useEffect(() => {
    if (wallet.publicKey) {
      const fetchBalance = async () => {
        try {
          const bal = await connection.getBalance(wallet.publicKey!);
          setBalance(bal / LAMPORTS_PER_SOL);
        } catch (e) {
          console.error("Error fetching balance", e);
        }
      };
      fetchBalance();
      const interval = setInterval(fetchBalance, 10000);
      return () => clearInterval(interval);
    } else {
      setBalance(0);
    }
  }, [wallet.publicKey, connection]);

  // Request Faucet Airdrop
  const handleAirdrop = async () => {
    if (!wallet.publicKey) return;
    setRequestingAirdrop(true);
    showNotice("info", "Iniciando solicitud de airdrop de 1 SOL en Devnet...");
    try {
      const signature = await connection.requestAirdrop(
        wallet.publicKey,
        1 * LAMPORTS_PER_SOL
      );
      // Wait for confirmation
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        ...latestBlockhash
      });
      showNotice("success", "¡Airdrop confirmado! Recibiste 1 SOL de prueba en tu wallet.");
    } catch (err: any) {
      console.error(err);
      showNotice(
        "error",
        "El grifo (faucet) de Solana está congestionado actualmente. Te sugerimos usar el 'Modo Demostración' si tu wallet no tiene SOL de prueba."
      );
    } finally {
      setRequestingAirdrop(false);
    }
  };

  const showNotice = (type: "success" | "error" | "info", text: string) => {
    setNotification({ type, text });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 6000);
  };

  // Generate image using Server Side Proxy (Gemini 2.5 Flash Image)
  const generateAIBrandMascot = async () => {
    if (!prompt.trim()) {
      showNotice("error", "Por favor ingresa una descripción para tu marca.");
      return;
    }

    setIsGenerating(true);
    showNotice("info", "Conectando con el motor AI...");
    setGeneratedMascot(null);
    setMintStatus({ step: "idle", message: "" });

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: selectedStyle }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Ocurrió un error en el servidor de IA.");
      }

      const mascot: GeneratedMascot = {
        imageUrl: data.imageUrl,
        prompt: prompt,
        style: selectedStyle,
        mimeType: data.mimeType || "image/png"
      };

      setGeneratedMascot(mascot);
      showNotice("success", "¡Personaje de marca generado exitosamente!");

      // Add to temporary logs
      const updatedHistory = [
        { ...mascot, minted: false, date: new Date().toLocaleDateString("es-ES") },
        ...history
      ];
      saveHistory(updatedHistory);
    } catch (err: any) {
      console.error(err);
      showNotice("error", `Error de generación de IA: ${err.message || "Servicio no disponible"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Mint Mascot as NFT (Umi logic + Demo simulator)
  const handleMintNFT = async () => {
    if (!generatedMascot) {
      showNotice("error", "Primero genera una mascota antes de mintear.");
      return;
    }

    if (mintingMode === "real") {
      if (!wallet.connected || !wallet.publicKey) {
        showNotice("error", "Por favor conecta tu wallet de Solana antes de mintear en modo real.");
        return;
      }

      if (balance < 0.05) {
        showNotice(
          "error",
          "Tu wallet tiene fondos insuficientes (se recomiendan al menos 0.05 SOL Devnet). Intenta solicitar un Airdrop o usa el 'Modo Demostración'."
        );
        return;
      }

      setMintStatus({
        step: "uploading_metadata",
        message: "Preparando assets y subiendo metadatos JSON a Irys..."
      });

      try {
        // Step 1: Convert base64 image to Uint8Array Binary
        const imgResponse = await fetch(generatedMascot.imageUrl);
        const imgBlob = await imgResponse.blob();
        const arrayBuffer = await imgBlob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Step 2: Create generic files for Metaplex Umi
        const file = createGenericFile(uint8Array, "brand_mascot.png", {
          contentType: generatedMascot.mimeType
        });

        // Step 3: Trigger real upload to Metaplex decentralised storage
        const [uploadedImageUri] = await umi.uploader.upload([file]);

        setMintStatus({
          step: "minting_nft",
          message: "Acuñando el NFT en los contratos de Metaplex (Devnet)..."
        });

        // Step 4: Upload JSON metadata containing image URI
        const jsonUri = await umi.uploader.uploadJson({
          name: `Mascota VIBE NFT`,
          symbol: "VIBENFT",
          description: `Logo/Mascota para empresa creado por IA con la plataforma VIBE - Solana Brand-to-NFT. Prompt: "${generatedMascot.prompt}"`,
          image: uploadedImageUri,
          attributes: [
            { trait_type: "Creador", value: "VIBE - Solana Brand-to-NFT" },
            { trait_type: "Plataforma", value: "VIBE" },
            { trait_type: "Idea de Marca", value: generatedMascot.prompt.substring(0, 100) },
            { trait_type: "Estilo", value: generatedMascot.style }
          ]
        });

        setMintStatus({
          step: "confirming",
          message: "Transacción enviada. Confirmando bloque en la red Solana..."
        });

        // Step 5: Mint the token Metadata using standard candy / token metadata V3
        const mintSigner = generateSigner(umi);
        const transactionResult = await createNft(umi, {
          mint: mintSigner,
          name: "VIBE Startup Brand",
          symbol: "VIBENFT",
          uri: jsonUri,
          sellerFeeBasisPoints: percentAmount(0),
        }).sendAndConfirm(umi);

        // Success!
        const txSigHex = Buffer.from(transactionResult.signature).toString("hex");
        const mintPubkey = mintSigner.publicKey.toString();

        setMintStatus({
          step: "success",
          message: "¡NFT Minteado exitosamente en tu wallet!",
          txHash: txSigHex,
          mintAddress: mintPubkey
        });

        showNotice("success", "¡Tu mascota de marca AI ya es un NFT oficial de Solana!");

        // Update local history
        const updated = history.map((item) => {
          if (item.imageUrl === generatedMascot.imageUrl) {
            return { ...item, minted: true, address: mintPubkey };
          }
          return item;
        });
        saveHistory(updated);
      } catch (err: any) {
        console.error("Metaplex Umi error:", err);
        setMintStatus({
          step: "error",
          message: `La transacción de Solana falló: ${err.message || "Falla en almacenamiento Irys"}`
        });
      }
    } else {
      // DEMO SIMULATOR MODE
      setMintStatus({
        step: "uploading_metadata",
        message: "[DEMO] Subiendo logo y metadatos JSON simulados al nodo Irys..."
      });

      await new Promise((r) => setTimeout(r, 1800));

      setMintStatus({
        step: "minting_nft",
        message: "[DEMO] Acuñando NFT de marca... Invocando autoridad de acuñación de Metaplex..."
      });

      await new Promise((r) => setTimeout(r, 1800));

      setMintStatus({
        step: "confirming",
        message: "[DEMO] Procesando firma de transacción. Esperando confirmación de bloque..."
      });

      await new Promise((r) => setTimeout(r, 1400));

      const mockMintAddress = Array.from({ length: 44 }, () =>
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
          Math.floor(Math.random() * 58)
        ]
      ).join("");

      const mockTx = Array.from({ length: 88 }, () =>
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"[
          Math.floor(Math.random() * 58)
        ]
      ).join("");

      setMintStatus({
        step: "success",
        message: "[DEMO] ¡Acuñación completada! El NFT ha sido enviado de forma virtual.",
        mintAddress: mockMintAddress,
        txHash: mockTx
      });

      showNotice("success", "Demo completa: NFT simulado en Devnet con éxito.");

      // Update local history
      const updated = history.map((item) => {
        if (item.imageUrl === generatedMascot.imageUrl) {
          return { ...item, minted: true, address: mockMintAddress };
        }
        return item;
      });
      saveHistory(updated);
    }
  };

  const selectPreset = (preset: typeof presetPrompts[0]) => {
    setPrompt(preset.text);
    setSelectedStyle(preset.style);
    showNotice("info", `Preset "${preset.label}" seleccionado`);
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col font-sans transition-colors selection:bg-[#9945FF]/20 selection:text-[#9945FF]">
      {/* Header */}
      <header className="border-b border-neutral-100 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9945FF] via-[#00C2FF] to-[#14F195] p-[1.5px] shadow-lg shadow-[#9945FF]/10 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-neutral-950 flex items-center justify-center font-bold text-lg text-white font-display">
                V
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 font-display">
                VIBE
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-[#9945FF] font-mono font-bold">
                Solana Brand-to-NFT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {wallet.connected && wallet.publicKey && (
              <div className="bg-neutral-50 border border-neutral-200/60 rounded-full px-4 py-2 flex items-center gap-2.5 shadow-sm text-xs text-neutral-700">
                <Coins className="w-4 h-4 text-[#14F195]" />
                <span>
                  Devnet: <b className="font-mono">{balance.toFixed(2)} SOL</b>
                </span>
                <button
                  onClick={handleAirdrop}
                  disabled={requestingAirdrop}
                  className="ml-2 bg-[#9945FF]/10 hover:bg-[#9945FF]/20 text-[#9945FF] px-2 py-0.5 rounded-full font-semibold transition-colors disabled:opacity-50 text-[10px]"
                  title="Obtener SOL gratis de prueba"
                >
                  {requestingAirdrop ? "Airdropping..." : "Faucet SOL"}
                </button>
              </div>
            )}
            
            {/* Solana Native Wallet Multi Button */}
            <div id="wallet-button-container" className="shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform">
              <WalletMultiButton>Conecta tu Wallet</WalletMultiButton>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 lg:py-12 flex flex-col gap-10">
        
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="bg-[#9945FF]/10 text-[#9945FF] hover:bg-[#9945FF]/15 transition-colors px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-mono">
            Zero design skills needed • Sol Vibe Devs
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 font-display md:leading-[1.12]">
            Genera la visual de tu startup con <span className="bg-gradient-to-r from-[#9945FF] to-[#00C2FF] bg-clip-text text-transparent">Inteligencia Articial</span> y conviértela en un NFT de Solana
          </h2>
          <p className="text-base text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Acuña al instante tu mascota comercial o logotipo directamente en tu wallet.
          </p>
        </div>

        {/* Notificaciones */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`max-w-xl mx-auto w-full p-4 rounded-xl border flex items-start gap-3 shadow-md ${
                notification.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : notification.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-medium">{notification.text}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid Secciones */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Izquierda: Prompt y Ajustes */}
          <section className="lg:col-span-7 bg-white rounded-3xl border border-neutral-100 p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
            
            <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100">
              <Cpu className="w-5 h-5 text-[#9945FF]" />
              <h3 className="text-lg font-bold text-neutral-950 font-display">
                Generador de Marca Creativa
              </h3>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest font-mono">
                ¿Falta de inspiración? Prueba un preset:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {presetPrompts.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => selectPreset(preset)}
                    className="p-3 text-left rounded-xl border border-neutral-200 hover:border-[#14F195] hover:bg-[#14F195]/5 text-xs font-medium transition-all text-neutral-800 line-clamp-1 cursor-pointer"
                  >
                    🚀 {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Form */}
            <div className="space-y-3">
              <label htmlFor="prompt-input" className="block text-sm font-semibold text-neutral-800">
                Describe el negocio o el personaje que quieres para tu producto
              </label>
              <textarea
                id="prompt-input"
                rows={4}
                className="w-full text-sm p-4 bg-neutral-50 hover:bg-neutral-50/50 focus:bg-white border border-neutral-200 rounded-2xl outline-none focus:ring-4 focus:ring-[#9945FF]/10 focus:border-[#9945FF] transition-all placeholder:text-neutral-400 font-sans leading-relaxed text-neutral-800"
                placeholder="Ejemplo: Un panda programador minimalista con lentes nerd, vestido con sudadera criptográfica morada, logo de empresa moderna..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Mascot Style Picker */}
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-neutral-800">Mascot / Art Style Preset</span>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "mascot-logo", label: "Mascot Logo (Gaming & Tech)" },
                  { id: "pixel-art2", label: "Retro Pixel Art" },
                  { id: "3d-avatar", label: "Modern 3D Render" }
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 text-center text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      selectedStyle === style.id
                        ? "border-[#9945FF] bg-[#9945FF]/5 text-[#9945FF]"
                        : "border-neutral-200 hover:border-neutral-300 text-neutral-600 bg-white"
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              onClick={generateAIBrandMascot}
              disabled={isGenerating || !prompt.trim()}
              className="w-full h-14 bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-95 text-white font-bold rounded-2xl transition-all shadow-md shadow-[#9945FF]/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Invocando a Nano Banana AI ({selectedStyle})...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-white" />
                  <span>Generar Identidad de Marca</span>
                </>
              )}
            </button>
          </section>

          {/* Columna Derecha: Preview y Acuñador Web3 */}
          <section className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
            
            <div className="bg-white rounded-3xl border border-neutral-100 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6">
              
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-[#14F195]" />
                  <h3 className="text-lg font-bold text-neutral-950 font-display">
                    NFT & Minting Console
                  </h3>
                </div>
                {/* Badge network state pointer */}
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  Solana Devnet
                </span>
              </div>

              {/* Mode Selector for mint type */}
              <div className="bg-neutral-50 p-1.5 rounded-2xl flex gap-2">
                <button
                  type="button"
                  onClick={() => setMintingMode("demo")}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mintingMode === "demo"
                      ? "bg-white text-neutral-900 border border-neutral-200/50 shadow-sm"
                      : "text-neutral-500 hover:text-neutral-800"
                  }`}
                >
                  ⚙️ Modo Demo (Simulado)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMintingMode("real");
                    if (!wallet.connected) {
                      showNotice("info", "Conecta tu Wallet para usar transacciones reales.");
                    }
                  }}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mintingMode === "real"
                      ? "bg-white text-[#9945FF] border border-[#9945FF]/10 shadow-sm"
                      : "text-neutral-500 hover:text-[#9945FF]"
                  }`}
                >
                  ⚡ Modo Real (Umi Metaplex)
                </button>
              </div>

              {/* Box Image Preview Area */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-neutral-50 border border-neutral-100 flex flex-col items-center justify-center p-4">
                {generatedMascot ? (
                  <div className="w-full h-full flex flex-col justify-between items-center relative group">
                    <img
                      src={generatedMascot.imageUrl}
                      alt="AI generated logo"
                      className="w-full h-full object-contain rounded-xl select-none"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Tiny stats overlay for branding info */}
                    <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-sm px-3 py-2 rounded-xl text-white text-[10px] font-mono flex justify-between items-center">
                      <span className="text-gray-300 truncate max-w-[200px]" title={generatedMascot.prompt}>
                        Prompt: f({generatedMascot.prompt.substring(0, 20)}...)
                      </span>
                      <span className="text-[#14F195]">AR 1:1</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-3">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-semibold text-neutral-800">
                      Esperando generación AI
                    </p>
                    <p className="text-xs text-neutral-500 max-w-[240px] leading-relaxed">
                      Escribe un prompt a la izquierda y presiona el botón para instanciar el arte inteligente de tu marca.
                    </p>
                  </div>
                )}
              </div>

              {/* Blockchain info warning when on real mode */}
              {mintingMode === "real" && (
                <div className="bg-[#9945FF]/5 border border-[#9945FF]/10 rounded-2xl p-4 text-xs space-y-2">
                  <div className="flex gap-2 items-center font-bold text-[#9945FF]">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Requisitos para mintear real:</span>
                  </div>
                  <ul className="list-disc list-inside text-neutral-600 space-y-1">
                    <li>Conectar wallet devnet de Solana (Phantom, Solflare, etc.).</li>
                    <li>
                      Fondos: <span className="font-mono text-neutral-900">~0.02 SOL</span> para tarifas y almacenamiento Irys.
                    </li>
                  </ul>
                  {wallet.connected ? (
                    <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Tu wallet: <b className="font-mono text-neutral-800">{wallet.publicKey?.toBase58().substring(0, 6)}...{wallet.publicKey?.toBase58().substring(38)}</b></span>
                      <span>Saldo: <b className="text-[#14F195] font-mono">{balance.toFixed(3)} SOL</b></span>
                    </div>
                  ) : (
                    <p className="text-neutral-500 font-medium">⚠️ Wallet desconectada. Por favor haz clic en "Select Wallet" arriba.</p>
                  )}
                </div>
              )}

              {/* Mint NFT button context */}
              <button
                onClick={handleMintNFT}
                disabled={!generatedMascot || (mintStatus.step !== "idle" && mintStatus.step !== "success" && mintStatus.step !== "error")}
                className={`w-full h-14 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow-sm ${
                  generatedMascot
                    ? "bg-neutral-950 text-white hover:bg-neutral-900 cursor-pointer"
                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                }`}
              >
                <Layers className="w-5 h-5 text-[#14F195]" />
                <span>
                  {mintStatus.step !== "idle" && mintStatus.step !== "success" && mintStatus.step !== "error"
                    ? "Acuñando..."
                    : mintingMode === "demo"
                    ? "Simular Minting en Solana"
                    : "Acuñar NFT Real (Metaplex)"}
                </span>
              </button>

              {/* Progress and status report tracker */}
              {mintStatus.step !== "idle" && (
                <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-100 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-neutral-800">
                    <span>Estado del Contrato:</span>
                    <span className="text-[#9945FF] capitalize font-mono text-[10px]">
                      {mintStatus.step.replace("_", " ")}
                    </span>
                  </div>

                  {/* Progress Line bar */}
                  <div className="h-1.5 w-full bg-neutral-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#9945FF] to-[#14F195] transition-all duration-500"
                      style={{
                        width:
                          mintStatus.step === "uploading_metadata"
                            ? "33%"
                            : mintStatus.step === "minting_nft"
                            ? "66%"
                            : mintStatus.step === "confirming"
                            ? "85%"
                            : mintStatus.step === "success"
                            ? "100%"
                            : "0%"
                      }}
                    ></div>
                  </div>

                  <p className="text-xs text-neutral-600 font-medium font-mono leading-relaxed">
                    ☕ {mintStatus.message}
                  </p>

                  {/* Success Result Box explorer URLs */}
                  {mintStatus.step === "success" && (
                    <div className="border-t border-neutral-100 pt-3 mt-1 space-y-2 text-xs">
                      {mintStatus.mintAddress && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Dirección Mint:</span>
                          <a
                            href={`https://explorer.solana.com/address/${mintStatus.mintAddress}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#9945FF] font-semibold hover:underline flex items-center gap-1 text-[11px]"
                          >
                            {mintStatus.mintAddress.substring(0, 6)}...{mintStatus.mintAddress.substring(38)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      
                      {mintStatus.txHash && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wider">Hash Tx:</span>
                          <a
                            href={`https://explorer.solana.com/tx/${mintStatus.txHash}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#00C2FF] font-semibold hover:underline flex items-center gap-1 text-[11px]"
                          >
                            {mintStatus.txHash.substring(0, 6)}...{mintStatus.txHash.substring(38)}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}

                      <div className="bg-emerald-50 text-emerald-800 p-2 text-center text-[10px] rounded-lg font-semibold border border-emerald-100">
                        🎉 ¡NFT disponible en Solana Devnet Explorer!
                      </div>
                    </div>
                  )}

                  {/* Error Box */}
                  {mintStatus.step === "error" && (
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl space-y-1.5">
                      <p className="text-[11px] font-bold text-rose-800">Causa Técnica Estimada:</p>
                      <p className="text-[10px] text-rose-700 font-mono leading-normal">
                        Falta de balance de gas en Solana, o saturación del airdrop. Por favor, asegúrate de tener SOL de prueba, o activa la palanca del <b>Modo Demo (Simulado)</b> para probar el minteo de Metaplex y ver cómo responde la interfaz.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* History / Created elements section */}
        <section className="bg-white rounded-3xl border border-neutral-100 p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-5">
          <div className="flex items-center gap-2.5 pb-2 border-b border-neutral-100 justify-between">
            <div className="flex items-center gap-2.5">
              <History className="w-5 h-5 text-neutral-800" />
              <h3 className="text-lg font-bold text-neutral-950 font-display">
                Colección Local de Logos Generados
              </h3>
            </div>
            <span className="bg-neutral-100 text-neutral-600 text-xs font-semibold px-2.5 py-1 rounded-full font-mono">
              {history.length} Diseños
            </span>
          </div>

          {history.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {history.map((mascot, index) => (
                <div
                  key={index}
                  className="bg-neutral-50 border border-neutral-200/50 rounded-2xl p-3 space-y-3 flex flex-col justify-between group hover:border-[#9945FF]/40 hover:shadow-sm transition-all"
                >
                  <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-white border border-neutral-100 flex items-center justify-center p-1.5">
                    <img
                      src={mascot.imageUrl}
                      alt={mascot.prompt}
                      className="w-full h-full object-contain select-none"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Status badge */}
                    {mascot.minted ? (
                      <span className="absolute top-1 right-1 bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase font-mono shadow-sm flex items-center gap-0.5">
                        <CheckCircle2 className="w-2 h-2" /> NFT Minted
                      </span>
                    ) : (
                      <span className="absolute top-1 right-1 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase font-mono shadow-sm">
                        Pre-NFT
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-[10px] text-neutral-400 font-semibold font-mono flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {mascot.date || "Fecha actual"}
                    </p>
                    <p className="text-[11px] text-neutral-700 font-medium line-clamp-2" title={mascot.prompt}>
                      {mascot.prompt}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-neutral-200/40 flex justify-between gap-1">
                    <button
                      onClick={() => {
                        setGeneratedMascot({
                          imageUrl: mascot.imageUrl,
                          prompt: mascot.prompt,
                          style: mascot.style,
                          mimeType: mascot.mimeType || "image/png"
                        });
                        setPrompt(mascot.prompt);
                        setSelectedStyle(mascot.style);
                        // scroll up smoothly
                        window.scrollTo({ top: 200, behavior: "smooth" });
                        showNotice("info", "Logo cargado en la consola de acuñación.");
                      }}
                      className="flex-1 py-1 px-2 text-[10px] font-bold bg-neutral-900 text-white hover:bg-[#9945FF] rounded-lg transition-colors cursor-pointer text-center animate-none"
                    >
                      Acuñar
                    </button>
                    
                    {mascot.address && (
                      <a
                        href={`https://explorer.solana.com/address/${mascot.address}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-neutral-500 hover:text-black border border-neutral-200 rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        title="Ver en Solana Explorer"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-neutral-400 text-xs border border-dashed border-neutral-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <History className="w-8 h-8 text-neutral-300" />
              <span>Aún no posees logotipos guardados localmente. Haz tu primera consulta AI.</span>
            </div>
          )}
        </section>



      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-neutral-100 py-8 px-6 mt-12 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            © 2026 VIBE - Solana Brand-to-NFT. Creado para el Solana Bootcamp.
          </p>
          <p className="flex items-center gap-1 justify-center">
            Diseñado con 💜 y tecnología Web3 por <span className="font-semibold text-neutral-800">Jeyson Colmenares</span>.
          </p>
        </div>
      </footer>
    </div>
  );
}
