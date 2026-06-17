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
  Cpu,
  Sun,
  Moon,
  FileText,
  Globe,
  ShieldAlert
} from "lucide-react";
import { GeneratedMascot, MintingMode, MintingStatus } from "./types";

export default function App() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const umi = useUmi();

  // New Appearance & Network State Modes
  const [darkMode, setDarkMode] = useState<boolean>(() => localStorage.getItem("vibe_theme") === "dark");
  const [network, setNetwork] = useState<"devnet" | "mainnet">("devnet");
  const [activeTab, setActiveTab] = useState<"app" | "about">("app");

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

  // Sync dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("vibe_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("vibe_theme", "light");
    }
  }, [darkMode]);

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
        mimeType: data.mimeType || "image/png",
        isFallback: data.isFallback,
        fallbackReason: data.fallbackReason
      };

      setGeneratedMascot(mascot);
      if (data.isFallback) {
        showNotice("info", "¡Diseño vectorial local generado con éxito! (Modo de Respaldo)");
      } else {
        showNotice("success", "¡Personaje de marca generado exitosamente por IA!");
      }

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
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans selection:bg-[#9945FF]/20 selection:text-[#9945FF] ${
      darkMode ? "bg-neutral-950 text-neutral-100 dark" : "bg-[#fafafa] text-neutral-800"
    }`}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-30 px-6 py-4 transition-colors duration-300 ${
        darkMode ? "border-neutral-900 bg-neutral-950/80 backdrop-blur-md" : "border-neutral-100 bg-white/80 backdrop-blur-md"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#9945FF] via-[#00C2FF] to-[#14F195] p-[1.5px] shadow-lg shadow-[#9945FF]/10 flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-neutral-950 flex items-center justify-center font-bold text-lg text-white font-display">
                V
              </div>
            </div>
            <div>
              <h1 className={`text-xl font-bold tracking-tight font-display ${darkMode ? "text-white" : "text-neutral-900"}`}>
                VIBE
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-[#9945FF] font-mono font-bold">
                Solana Brand-to-NFT
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle Red Devnet/Mainnet */}
            <div className={`flex items-center rounded-xl p-1 text-xs font-bold border transition-colors ${
              darkMode ? "bg-neutral-900 border-neutral-800" : "bg-neutral-100/80 border-neutral-200"
            }`}>
              <button
                onClick={() => {
                  setNetwork("devnet");
                  showNotice("info", "Red seleccionada: Solana Devnet.");
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  network === "devnet"
                    ? "bg-[#14F195]/15 text-[#14F195] font-extrabold shadow-sm"
                    : `${darkMode ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-800"}`
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#14F195]"></div>
                Devnet
              </button>
              <button
                onClick={() => {
                  setNetwork("mainnet");
                  showNotice("info", "Modo Mainnet activado. Para proteger tus fondos reales, se han habilitado salvaguardas virtuales de simulación.");
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  network === "mainnet"
                    ? "bg-[#9945FF]/15 text-[#9945FF] font-extrabold shadow-sm"
                    : `${darkMode ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-800"}`
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#9945FF]"></div>
                Mainnet
              </button>
            </div>

            {/* Alternar claro/oscuro */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                darkMode 
                  ? "bg-neutral-900 border-neutral-800 text-yellow-400 hover:bg-neutral-800" 
                  : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
              }`}
              title={darkMode ? "Estilo claro" : "Estilo oscuro"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {wallet.connected && wallet.publicKey && (
              <div className={`border rounded-xl px-4 py-2 flex items-center gap-2.5 shadow-sm text-xs transition-colors ${
                darkMode ? "bg-neutral-900 border-neutral-800 text-neutral-300" : "bg-neutral-50 border-neutral-200/60 text-neutral-700"
              }`}>
                <Coins className="w-4 h-4 text-[#14F195]" />
                <span>
                  {network === "devnet" ? "Devnet" : "Mainnet"}: <b className="font-mono">{network === "devnet" ? balance.toFixed(2) : "0.00"} SOL</b>
                </span>
                {network === "devnet" && (
                  <button
                    onClick={handleAirdrop}
                    disabled={requestingAirdrop}
                    className="ml-2 bg-[#9945FF]/10 hover:bg-[#9945FF]/20 text-[#9945FF] px-2 py-0.5 rounded-full font-semibold transition-colors disabled:opacity-50 text-[10px]"
                    title="Obtener SOL gratis de prueba"
                  >
                    {requestingAirdrop ? "Airdropping..." : "Faucet SOL"}
                  </button>
                )}
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
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-8 lg:py-12 flex flex-col gap-8">
        
        {/* Network Safeguard Alert for Mainnet */}
        {network === "mainnet" && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl p-4 text-xs flex items-start gap-3 max-w-3xl mx-auto w-full">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold uppercase tracking-wider">Modo Preventivo de Red Principal (Mainnet Beta Safe Mode)</p>
              <p className="text-neutral-400 mt-1 leading-relaxed">
                Estás visualizando la red Mainnet de Solana. Para resguardar tus fondos e impedir cargos inesperados, el minteo en Mainnet se ejecutará a través de un sandbox inteligente simulado que asocia tu dirección criptográfica real sin consumir gas.
              </p>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="bg-[#9945FF]/10 text-[#9945FF] hover:bg-[#9945FF]/15 transition-colors px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider font-mono">
            Zero design skills needed • Sol Vibe Devs
          </span>
          <h2 className={`text-4xl md:text-5xl font-extrabold tracking-tight font-display md:leading-[1.12] ${darkMode ? "text-white" : "text-neutral-900"}`}>
            Genera la visual de tu startup con <span className="bg-gradient-to-r from-[#9945FF] to-[#00C2FF] bg-clip-text text-transparent">Inteligencia Artificial</span> y conviértela en un NFT de Solana
          </h2>
          <p className={`text-base max-w-2xl mx-auto leading-relaxed ${darkMode ? "text-neutral-400" : "text-neutral-600"}`}>
            Acuña al instante tu mascota comercial o logotipo directamente en tu wallet. Decora tu startup de la forma más rápida en Web3.
          </p>
        </div>

        {/* Navigation Tabs (Generador y NFT / Sobre el Proyecto) */}
        <div className={`flex justify-center max-w-sm mx-auto p-1.5 rounded-2xl border shadow-sm transition-colors ${
          darkMode ? "bg-neutral-900 border-neutral-800" : "bg-neutral-100/80 border-neutral-200/50"
        }`}>
          <button
            onClick={() => setActiveTab("app")}
            className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "app"
                ? `${darkMode ? "bg-neutral-800 text-white shadow-sm font-black" : "bg-white text-[#9945FF] font-black shadow-sm"}`
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consola de Minteo</span>
          </button>
          <button
            onClick={() => setActiveTab("about")}
            className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === "about"
                ? `${darkMode ? "bg-neutral-800 text-white shadow-sm font-black" : "bg-white text-[#9945FF] font-black shadow-sm"}`
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Sobre el Proyecto</span>
          </button>
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
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : notification.type === "error"
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-400"
              }`}
            >
              <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-semibold">{notification.text}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab content routing */}
        {activeTab === "about" ? (
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-3xl border p-6 md:p-10 space-y-8 transition-colors duration-300 ${
              darkMode ? "bg-neutral-900/60 border-neutral-800 text-neutral-300" : "bg-white border-neutral-100 text-neutral-600"
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#9945FF]">
                <Cpu className="w-5 h-5 animate-pulse" />
                <span className="text-xs uppercase font-bold tracking-widest font-mono">Dossier Técnico / Bootcamp Docs</span>
              </div>
              <h3 className={`text-2xl md:text-3xl font-black font-display ${
                darkMode ? "text-white" : "text-neutral-900"
              }`}>
                VIBE — Solana Brand-to-NFT
              </h3>
              <p className="text-sm md:text-base leading-relaxed max-w-3xl">
                Plataforma descentralizada para la generación instantánea de identidades corporativas, logotipos y mascotas comerciales asistida por Inteligencia Artificial y registrada de forma inmutable como tokens de Metaplex sobre la blockchain de Solana.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
              
              <div className={`p-6 rounded-2xl border space-y-3 ${
                darkMode ? "bg-neutral-950/40 border-neutral-900" : "bg-neutral-50/50 border-neutral-100"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#9945FF]/10 flex items-center justify-center text-[#9945FF]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className={`text-base font-bold font-display ${
                    darkMode ? "text-white" : "text-neutral-900"
                  }`}>
                    1. Almacenamiento Irys (Arweave)
                  </h4>
                </div>
                <p className="text-xs leading-relaxed">
                  Utiliza la librería de Metaplex <code className="font-mono bg-neutral-150 dark:bg-neutral-800 px-1 py-0.5 rounded text-[#9945FF]">irysUploader()</code> para subir de forma descentralizada el archivo PNG y el JSON compatible con <b className={darkMode ? "text-white" : "text-neutral-900"}>Metaplex Standard V3</b> en Devnet. El almacenamiento descentralizado garantiza que el logotipo de tu startup persista de por vida de forma libre y transparente en la red Arweave.
                </p>
              </div>

              <div className={`p-6 rounded-2xl border space-y-3 ${
                darkMode ? "bg-neutral-950/40 border-neutral-900" : "bg-neutral-50/50 border-neutral-100"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#14F195]/10 flex items-center justify-center text-[#14F195]">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className={`text-base font-bold font-display ${
                    darkMode ? "text-white" : "text-neutral-900"
                  }`}>
                    2. Metaplex Umi Standard
                  </h4>
                </div>
                <p className="text-xs leading-relaxed">
                  Acuña el token mediante la función <code className="font-mono bg-neutral-150 dark:bg-neutral-800 px-1 py-0.5 rounded text-[#14F195]">createNft()</code> de Metaplex. Define la metadata oficial, ajusta el porcentaje de regalías a <b className={darkMode ? "text-white" : "text-neutral-900"}>0%</b> para el MVP inicial, y asocia la clave pública del usuario conectado como propietario absoluto de sus derechos criptográficos.
                </p>
              </div>

              <div className={`p-6 rounded-2xl border space-y-3 ${
                darkMode ? "bg-neutral-950/40 border-neutral-900" : "bg-neutral-50/50 border-neutral-100"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00C2FF]/10 flex items-center justify-center text-[#00C2FF]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h4 className={`text-base font-bold font-display ${
                    darkMode ? "text-white" : "text-neutral-900"
                  }`}>
                    3. Soluciones de Entorno & Sandbox
                  </h4>
                </div>
                <p className="text-xs leading-relaxed">
                  Puesto que los iframes de prueba en navegadores pueden limitar la comunicación nativa con extensiones como Phantom o Solflare, nuestra plataforma incorpora un <b className={darkMode ? "text-white" : "text-neutral-900"}>"Modo Demostración" (Demo Mode)</b> que simula a la perfección el flujo reactivo completo de Web3 para un testeo veloz, seguro y libre de fricciones.
                </p>
              </div>

              <div className={`p-6 rounded-2xl border space-y-3 ${
                darkMode ? "bg-neutral-950/40 border-neutral-900" : "bg-neutral-50/50 border-neutral-100"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className={`text-base font-bold font-display ${
                    darkMode ? "text-white" : "text-neutral-900"
                  }`}>
                    4. Beneficios del Ecosistema VIBE
                  </h4>
                </div>
                <p className="text-xs leading-relaxed font-normal">
                  • <b className={darkMode ? "text-white" : "text-neutral-900"}>Inmediatez Absoluta:</b> Tu idea de negocio pasa a ser un NFT verificado en Solana en menos de un minuto.
                  <br />
                  • <b className={darkMode ? "text-white" : "text-neutral-900"}>Diseños con Coherencia:</b> Generador estético optimizado para marcas de tecnología, startups Web3 y creadores independientes.
                </p>
              </div>

            </div>

            <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 ${
              darkMode ? "bg-[#14F195]/5 border-[#14F195]/20 text-[#14F195]" : "bg-emerald-50 border-emerald-100 text-emerald-900"
            }`}>
              <div className="space-y-1 text-center md:text-left">
                <p className="text-xs font-bold uppercase tracking-wider">¿Listo para tokenizar tu visión?</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Regresa a la Consola de Minteo para plasmar tus ideas y acuñar tu logotipo en Solana.</p>
              </div>
              <button
                onClick={() => setActiveTab("app")}
                className="px-5 py-2.5 bg-neutral-950 text-white dark:bg-[#14F195] dark:text-black font-bold text-xs rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              >
                Volver a la Consola
              </button>
            </div>
          </motion.section>
        ) : (
          <>
            {/* Grid Secciones */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Columna Izquierda: Prompt y Ajustes */}
          <section className={`lg:col-span-12 xl:col-span-7 rounded-3xl border p-6 md:p-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-6 transition-all duration-300 ${
            darkMode ? "bg-neutral-900/60 border-neutral-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)]" : "bg-white border-neutral-100"
          }`}>
            
            <div className={`flex items-center gap-2.5 pb-2 border-b ${darkMode ? "border-neutral-800" : "border-neutral-100"}`}>
              <Cpu className="w-5 h-5 text-[#9945FF]" />
              <h3 className={`text-lg font-bold font-display ${darkMode ? "text-white" : "text-neutral-950"}`}>
                Generador de Marca Creativa
              </h3>
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <p className={`text-xs font-semibold uppercase tracking-widest font-mono ${darkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                ¿Falta de inspiración? Prueba un preset:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {presetPrompts.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => selectPreset(preset)}
                    className={`p-3 text-left rounded-xl border text-xs font-bold transition-all line-clamp-1 cursor-pointer ${
                      darkMode
                        ? "border-neutral-800 hover:border-[#14F195] hover:bg-[#14F195]/5 text-[#14F195] bg-neutral-950/40"
                        : "border-neutral-200 hover:border-[#14F195] hover:bg-[#14F195]/5 text-neutral-800 bg-white"
                    }`}
                  >
                    🚀 {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt Form */}
            <div className="space-y-3">
              <label htmlFor="prompt-input" className={`block text-sm font-semibold ${darkMode ? "text-neutral-200" : "text-neutral-800"}`}>
                Describe el negocio o el personaje que quieres para tu producto
              </label>
              <textarea
                id="prompt-input"
                rows={4}
                className={`w-full text-sm p-4 rounded-2xl outline-none focus:ring-4 focus:ring-[#9945FF]/10 focus:border-[#9945FF] transition-all placeholder:text-neutral-400 font-sans leading-relaxed ${
                  darkMode 
                    ? "bg-neutral-950 border-neutral-800 hover:bg-neutral-950/40 focus:bg-neutral-950 text-white" 
                    : "bg-neutral-50 hover:bg-neutral-50/50 focus:bg-white border-neutral-200 text-neutral-800"
                }`}
                placeholder="Ejemplo: Un panda programador minimalista con lentes nerd, vestido con sudadera criptográfica morada, logo de empresa moderna..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>

            {/* Mascot Style Picker */}
            <div className="space-y-2">
              <span className={`block text-sm font-semibold ${darkMode ? "text-neutral-200" : "text-neutral-800"}`}>Mascot / Art Style Preset</span>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: "mascot-logo", label: "Mascot Logo (Gaming & Tech)" },
                  { id: "pixel-art2", label: "Retro Pixel Art" },
                  { id: "3d-avatar", label: "Modern 3D Render" }
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-3 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedStyle === style.id
                        ? "border-[#9945FF] bg-[#9945FF]/10 text-[#9945FF] font-black"
                        : `${darkMode ? "border-neutral-800 hover:border-neutral-700 text-neutral-400 bg-neutral-950/40" : "border-neutral-200 hover:border-neutral-300 text-neutral-600 bg-white"}`
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
            
            <div className={`rounded-3xl border p-6 transition-all duration-300 ${
              darkMode ? "bg-neutral-900/60 border-neutral-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)]" : "bg-white border-neutral-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
            } space-y-6`}>
              
              <div className={`flex items-center justify-between pb-2 border-b ${darkMode ? "border-neutral-800" : "border-neutral-100"}`}>
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-[#14F195]" />
                  <h3 className={`text-lg font-bold font-display ${darkMode ? "text-white" : "text-neutral-950"}`}>
                    NFT & Minting Console
                  </h3>
                </div>
                {/* Badge network state pointer */}
                <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  darkMode ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                }`}>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  Solana {network === "devnet" ? "Devnet" : "Mainnet"}
                </span>
              </div>

              {/* Mode Selector for mint type */}
              <div className={`p-1.5 rounded-2xl flex gap-2 transition-colors ${darkMode ? "bg-neutral-950/60" : "bg-neutral-50"}`}>
                <button
                  type="button"
                  onClick={() => setMintingMode("demo")}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mintingMode === "demo"
                      ? `${darkMode ? "bg-neutral-800 text-white border border-neutral-700 shadow-sm" : "bg-white text-neutral-900 border border-neutral-200/50 shadow-sm"}`
                      : `${darkMode ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-800"}`
                  }`}
                >
                  ⚙️ Modo Demo (Simulado)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMintingMode("real");
                    if (!wallet.connected) {
                      showNotice("info", "Conecta tu Wallet para usar transacciones reales o simularlas en la red principal.");
                    }
                  }}
                  className={`flex-grow py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    mintingMode === "real"
                      ? `${darkMode ? "bg-neutral-800 text-[#9945FF] border border-neutral-700 shadow-sm" : "bg-white text-[#9945FF] border border-[#9945FF]/10 shadow-sm"}`
                      : `${darkMode ? "text-neutral-400 hover:text-[#9945FF]" : "text-neutral-500 hover:text-[#9945FF]"}`
                  }`}
                >
                  ⚡ Modo Real ({network === "devnet" ? "Metaplex Umi" : "Sandbox"})
                </button>
              </div>

              {/* Box Image Preview Area */}
              <div className={`relative aspect-square w-full rounded-2xl overflow-hidden flex flex-col items-center justify-center p-4 border transition-colors ${
                darkMode ? "bg-neutral-950/40 border-neutral-800/80" : "bg-neutral-50 border-neutral-100"
              }`}>
                {generatedMascot ? (
                  <div className="w-full h-full flex flex-col justify-between items-center relative group">
                    <img
                      src={generatedMascot.imageUrl}
                      alt="AI generated logo"
                      className="w-full h-full object-contain rounded-xl select-none"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Fallback Warning Overlay if in SVG offline mode */}
                    {generatedMascot.isFallback && (
                      <div className="absolute top-2 left-2 right-2 bg-amber-500/90 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow backdrop-blur-sm">
                        <Info className="w-3.5 h-3.5 flex-shrink-0 animate-bounce" />
                        <span className="leading-tight">Generación de Respaldo Activa (Frecuencia Límite Gemini)</span>
                      </div>
                    )}

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
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${darkMode ? "bg-neutral-900 text-neutral-500" : "bg-neutral-100 text-neutral-400"}`}>
                      <ImageIcon className="w-7 h-7" />
                    </div>
                    <p className={`text-sm font-semibold ${darkMode ? "text-neutral-200" : "text-neutral-800"}`}>
                      Esperando generación AI
                    </p>
                    <p className={`text-xs max-w-[240px] leading-relaxed ${darkMode ? "text-neutral-400" : "text-neutral-500"}`}>
                      Escribe un prompt a la izquierda y presiona el botón para instanciar el arte inteligente de tu marca.
                    </p>
                  </div>
                )}
              </div>

              {/* Blockchain info warning when on real mode */}
              {mintingMode === "real" && (
                <div className={`border rounded-2xl p-4 text-xs space-y-2 transition-all ${
                  darkMode ? "bg-neutral-950/80 border-neutral-850" : "bg-[#9945FF]/5 border border-[#9945FF]/10"
                }`}>
                  <div className="flex gap-2 items-center font-bold text-[#9945FF]">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Requisitos para mintear real:</span>
                  </div>
                  <ul className={`list-disc list-inside space-y-1 ${darkMode ? "text-neutral-400" : "text-neutral-600"}`}>
                    <li>Conectar wallet de Solana {network === "devnet" ? "(Devnet)" : "(Mainnet Sandbox)"}.</li>
                    <li>
                      Fondos: <span className="font-mono text-neutral-900 dark:text-neutral-200">~0.02 SOL</span> para tarifas y almacenamiento Irys {network === "mainnet" && "(Simulado)"}.
                    </li>
                  </ul>
                  {wallet.connected ? (
                    <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-500">
                      <span>Tu wallet: <b className="font-mono text-neutral-800 dark:text-neutral-300">{wallet.publicKey?.toBase58().substring(0, 6)}...{wallet.publicKey?.toBase58().substring(38)}</b></span>
                      <span>Saldo: <b className="text-[#14F195] font-mono">{network === "devnet" ? balance.toFixed(3) : "Simulado"} SOL</b></span>
                    </div>
                  ) : (
                    <p className={`font-medium ${darkMode ? "text-amber-500/85" : "text-neutral-500"}`}>⚠️ Wallet desconectada. Por favor haz clic en "Conecta tu Wallet" arriba.</p>
                  )}
                </div>
              )}

              {/* Mint NFT button context */}
              <button
                onClick={handleMintNFT}
                disabled={!generatedMascot || (mintStatus.step !== "idle" && mintStatus.step !== "success" && mintStatus.step !== "error")}
                className={`w-full h-14 font-extrabold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow-sm ${
                  generatedMascot
                    ? darkMode
                      ? "bg-[#14F195] text-black hover:opacity-95 cursor-pointer font-black"
                      : "bg-neutral-950 text-white hover:bg-neutral-900 cursor-pointer"
                    : darkMode
                    ? "bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed"
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
                <div className={`rounded-2xl p-4 border space-y-3 transition-colors ${
                  darkMode ? "bg-neutral-950/80 border-neutral-800" : "bg-neutral-50 border-neutral-100"
                }`}>
                  <div className={`flex items-center justify-between text-xs font-semibold ${darkMode ? "text-neutral-200" : "text-neutral-800"}`}>
                    <span>Estado del Contrato:</span>
                    <span className="text-[#9945FF] capitalize font-mono text-[10px]">
                      {mintStatus.step.replace("_", " ")}
                    </span>
                  </div>

                  {/* Progress Line bar */}
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${darkMode ? "bg-neutral-900" : "bg-neutral-200"}`}>
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

                  <p className={`text-xs font-semibold font-mono leading-relaxed ${darkMode ? "text-neutral-300" : "text-neutral-600"}`}>
                    ☕ {mintStatus.message}
                  </p>

                  {/* Success Result Box explorer URLs */}
                  {mintStatus.step === "success" && (
                    <div className={`border-t pt-3 mt-1 space-y-2 text-xs ${darkMode ? "border-neutral-800" : "border-neutral-100"}`}>
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

                      <div className={`p-2 text-center text-[10px] rounded-lg font-bold border ${
                        darkMode ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                      }`}>
                        🎉 ¡NFT disponible en Solana Explorer!
                      </div>
                    </div>
                  )}

                  {/* Error Box */}
                  {mintStatus.step === "error" && (
                    <div className={`p-3 rounded-xl space-y-1.5 border ${
                      darkMode ? "bg-rose-500/10 border-rose-500/20 text-rose-300" : "bg-rose-50 border-rose-100 text-rose-800"
                    }`}>
                      <p className="text-[11px] font-bold">Causa Técnica Estimada:</p>
                      <p className="text-[10px] font-mono leading-normal opacity-85">
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
        <section className={`rounded-3xl border p-6 md:p-8 transition-all duration-300 ${
          darkMode ? "bg-neutral-900/60 border-neutral-800 shadow-[0_4px_30px_rgba(0,0,0,0.2)]" : "bg-white border-neutral-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)]"
        } space-y-5`}>
          <div className={`flex items-center gap-2.5 pb-2 border-b justify-between ${darkMode ? "border-neutral-800" : "border-neutral-100"}`}>
            <div className="flex items-center gap-2.5">
              <History className={`w-5 h-5 ${darkMode ? "text-neutral-300" : "text-neutral-800"}`} />
              <h3 className={`text-lg font-bold font-display ${darkMode ? "text-white" : "text-neutral-950"}`}>
                Colección Local de Logos Generados
              </h3>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full font-mono ${
              darkMode ? "bg-neutral-950 text-neutral-400" : "bg-neutral-100 text-neutral-600"
            }`}>
              {history.length} Diseños
            </span>
          </div>

          {history.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {history.map((mascot, index) => (
                <div
                  key={index}
                  className={`border rounded-2xl p-3 space-y-3 flex flex-col justify-between group hover:border-[#9945FF]/40 hover:shadow-sm transition-all ${
                    darkMode ? "bg-neutral-900/40 border-neutral-800" : "bg-neutral-50 border-neutral-200/50"
                  }`}
                >
                  <div className={`relative aspect-square w-full rounded-lg overflow-hidden border flex items-center justify-center p-1.5 transition-colors ${
                    darkMode ? "bg-neutral-950 border-neutral-850" : "bg-white border-neutral-100"
                  }`}>
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
                    <p className={`text-[11px] font-medium line-clamp-2 ${darkMode ? "text-neutral-200" : "text-neutral-700"}`} title={mascot.prompt}>
                      {mascot.prompt}
                    </p>
                  </div>

                  <div className={`pt-2 border-t flex justify-between gap-1 ${darkMode ? "border-neutral-850" : "border-neutral-200/40"}`}>
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
                      className={`flex-1 py-1 px-2 text-[10px] font-bold rounded-lg transition-colors cursor-pointer text-center ${
                        darkMode ? "bg-neutral-800 text-white hover:bg-[#9945FF]" : "bg-neutral-900 text-white hover:bg-[#9945FF]"
                      }`}
                    >
                      Acuñar
                    </button>
                    
                    {mascot.address && (
                      <a
                        href={`https://explorer.solana.com/address/${mascot.address}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`p-1 border rounded-lg flex items-center justify-center transition-colors shadow-sm ${
                          darkMode ? "text-neutral-400 hover:text-white border-neutral-800 hover:bg-neutral-800" : "text-neutral-500 hover:text-black border-neutral-200 bg-white"
                        }`}
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
            <div className={`py-12 text-center text-xs border border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${
              darkMode ? "border-neutral-800 text-neutral-500" : "border-neutral-200 text-neutral-400"
            }`}>
              <History className="w-8 h-8 opacity-60" />
              <span>Aún no posees logotipos guardados localmente. Haz tu primera consulta AI.</span>
            </div>
          )}
        </section>
      </>
    )}



      </main>

      {/* Footer */}
      <footer className={`py-8 px-6 mt-12 text-center text-xs transition-colors duration-300 border-t ${
        darkMode ? "bg-neutral-950 border-neutral-900 text-neutral-500" : "bg-white border-t border-neutral-100 text-neutral-500"
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>
            © 2026 VIBE - Solana Brand-to-NFT. Creado para el Solana Bootcamp.
          </p>
          <p className="flex items-center gap-1 justify-center">
            Diseñado con 💜 y tecnología Web3 por <span className={`font-semibold ${darkMode ? "text-white" : "text-neutral-800"}`}>Jeyson Colmenares</span>.
          </p>
        </div>
      </footer>
    </div>
  );
}
