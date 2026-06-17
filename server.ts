import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Gemini Client with custom User-Agent as required by the platform instructions
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

app.use(express.json({ limit: "50mb" }));

// Image Generation Endpoint using modern Google GenAI SDK
app.post("/api/generate", async (req, res) => {
  const { prompt, style = "mascot-logo" } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "La descripción es requerida (Prompt is required)." });
  }

  try {
    // Enhance the prompt for brand mascot/logo styling based on selection
    let styleGuide = "Minimalist modern logo mascot, suitable for a Solana premium NFT, vibrant vectors, clean path render, white or transparent background.";
    if (style === "pixel-art2") {
      styleGuide = "Cute retro 16-bit pixel art character, game-ready sprite asset, vibrant retro gaming colors, solid outline, crisp pixels.";
    } else if (style === "3d-avatar") {
      styleGuide = "Chibi 3D claymation style rendering, smooth matte round materials, cute big glassy eyes, studio lighting, soft shadows, blender style.";
    }

    const enhancedPrompt = `${prompt}. Style: ${styleGuide}. High contrast, high-resolution aesthetic design layout.`;

    console.log("Generando imagen con Gemini para el prompt:", enhancedPrompt);

    // If API Key is missing, trigger fallback immediately to avoid crash
    if (!apiKey) {
      console.warn("GEMINI_API_KEY no configurado. Utilizando motor de diseño vectorial local...");
      const fallbackUrl = generateFallbackImage(prompt, style);
      return res.json({
        imageUrl: fallbackUrl,
        prompt: enhancedPrompt,
        mimeType: "image/svg+xml",
        isFallback: true,
        fallbackReason: "API Key ausente. Se activó el Generador de Identidad Adaptativo de VIBE."
      });
    }

    // Call modern gemini-2.5-flash-image via GoogleGenAI SDK
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: enhancedPrompt,
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    let base64Image = null;

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (base64Image) {
      res.json({
        imageUrl: `data:image/png;base64,${base64Image}`,
        prompt: enhancedPrompt,
        mimeType: "image/png",
        isFallback: false
      });
    } else {
      console.warn("No se pudo extraer la imagen del modelo de IA. Utilizando motor de diseño vectorial local...");
      const fallbackUrl = generateFallbackImage(prompt, style);
      res.json({
        imageUrl: fallbackUrl,
        prompt: enhancedPrompt,
        mimeType: "image/svg+xml",
        isFallback: true,
        fallbackReason: "Formato no válido del modelo de IA. Se generó un arte vectorial adaptativo."
      });
    }
  } catch (error: any) {
    console.error("Error al generar la imagen con Gemini. Activando generador vectorial local fallback:", error);
    
    // Auto fallback for Rate limits, Quotas (429) or other API issues
    try {
      const isQuotaError = error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED") || error.status === 429 || error.statusCode === 429;
      const reason = isQuotaError 
        ? "Límite de cuota excedido en la API pública de Gemini (Rate Limit 429). Se activó el motor de diseño adaptativo VIBE."
        : `Servicio de IA temporalmente en mantenimiento (${error.message || "Error"}). Se generó una alternativa de alta fidelidad.`;
      
      const fallbackUrl = generateFallbackImage(prompt, style);
      res.json({
        imageUrl: fallbackUrl,
        prompt: prompt,
        mimeType: "image/svg+xml",
        isFallback: true,
        fallbackReason: reason
      });
    } catch (fallbackErr) {
      res.status(500).json({
        error: "Error crítico al intentar generar una imagen de respaldo local.",
      });
    }
  }
});

// Helper function to generate high-fidelity polished SVG graphics locally
function generateFallbackImage(prompt: string, style: string): string {
  const cleanPrompt = prompt.trim();
  const initials = cleanPrompt
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .substring(0, 3)
    .toUpperCase() || "VIBE";

  let svg = "";

  if (style === "pixel-art2") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <pattern id="pixelGrid" width="32" height="32" patternUnits="userSpaceOnUse">
          <rect width="32" height="32" fill="none" stroke="#222" stroke-width="2"/>
        </pattern>
      </defs>
      <rect width="512" height="512" fill="#0f0f13"/>
      <rect width="512" height="512" fill="url(#pixelGrid)" opacity="0.3"/>
      
      <rect x="32" y="32" width="448" height="448" fill="none" stroke="#9945FF" stroke-width="8" />
      <rect x="40" y="40" width="432" height="432" fill="none" stroke="#14F195" stroke-width="8" />
      
      <g transform="translate(156, 120)">
        <rect x="32" y="32" width="136" height="136" fill="#14F195" opacity="0.8" />
        <rect x="48" y="48" width="104" height="104" fill="#9945FF" />
        <rect x="64" y="80" width="16" height="16" fill="#fff" />
        <rect x="120" y="80" width="16" height="16" fill="#fff" />
        <rect x="72" y="84" width="8" height="8" fill="#000" />
        <rect x="128" y="84" width="8" height="8" fill="#000" />
        <rect x="80" y="112" width="40" height="8" fill="#fff" />
        <rect x="80" y="120" width="8" height="8" fill="#fff" />
        <rect x="112" y="120" width="8" height="8" fill="#fff" />
      </g>

      <rect x="64" y="320" width="384" height="80" rx="8" fill="#15151e" stroke="#00C2FF" stroke-width="4"/>
      
      <text x="50%" y="370" font-family="'Courier New', monospace" font-weight="900" font-size="28" fill="#14F195" text-anchor="middle" letter-spacing="4">
        ${initials}
      </text>
      <text x="50%" y="435" font-family="'Courier New', monospace" font-size="12" fill="#888" text-anchor="middle">
        VIBE GENERATOR: RETRO PIXEL DEMO
      </text>
    </svg>`;
  } else if (style === "3d-avatar") {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <radialGradient id="softGloss" cx="40%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
          <stop offset="50%" stop-color="#9945FF" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#120c1e"/>
        </radialGradient>
        <radialGradient id="vibeSphere" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00C2FF"/>
          <stop offset="70%" stop-color="#9945FF"/>
          <stop offset="100%" stop-color="#14F195"/>
        </radialGradient>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1a1132"/>
          <stop offset="50%" stop-color="#0a0515"/>
          <stop offset="100%" stop-color="#051211"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#bgGrad)"/>
      
      <circle cx="256" cy="230" r="140" fill="#00C2FF" opacity="0.15"/>
      <circle cx="256" cy="230" r="90" fill="#9945FF" opacity="0.2"/>
      
      <rect x="166" y="110" width="180" height="240" rx="90" fill="url(#softGloss)" stroke="#ffffff" stroke-width="2"/>
      
      <g transform="translate(166, 110)">
        <circle cx="55" cy="90" r="24" fill="#ffffff"/>
        <circle cx="57" cy="88" r="14" fill="#0a0515"/>
        <circle cx="61" cy="84" r="6" fill="#ffffff" opacity="0.9"/>
        <circle cx="125" cy="90" r="24" fill="#ffffff"/>
        <circle cx="123" cy="88" r="14" fill="#0a0515"/>
        <circle cx="127" cy="84" r="6" fill="#ffffff" opacity="0.9"/>
        
        <ellipse cx="35" cy="120" rx="12" ry="6" fill="#ff007f" opacity="0.4"/>
        <ellipse cx="145" cy="120" rx="12" ry="6" fill="#ff007f" opacity="0.4"/>
        
        <path d="M 80,118 Q 90,132 100,118" fill="none" stroke="#0a0515" stroke-width="4" stroke-linecap="round"/>
      </g>
      
      <circle cx="256" cy="380" r="45" fill="url(#vibeSphere)" stroke="#ffffff" stroke-width="3"/>
      <text x="256" y="392" font-family="'Inter', sans-serif" font-weight="900" font-size="28" fill="#ffffff" text-anchor="middle">
        ${initials}
      </text>
      
      <text x="50%" y="465" font-family="'Inter', sans-serif" font-weight="500" font-size="12" fill="#14F195" text-anchor="middle" letter-spacing="1">
        VIBE GENERATOR: 3D CLAY FALLBACK
      </text>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
      <defs>
        <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#9945FF"/>
          <stop offset="50%" stop-color="#00C2FF"/>
          <stop offset="100%" stop-color="#14F195"/>
        </linearGradient>
        <radialGradient id="ringGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#14F195" stop-opacity="0.8"/>
          <stop offset="100%" stop-color="#9945FF" stop-opacity="0.2"/>
        </radialGradient>
      </defs>
      
      <rect width="512" height="512" fill="#09080d"/>
      
      <polygon points="256,48 432,136 432,328 256,448 80,328 80,136" fill="#12111d" stroke="url(#gradient1)" stroke-width="4"/>
      
      <circle cx="256" cy="230" r="110" fill="url(#ringGrad)"/>
      <circle cx="256" cy="230" r="95" fill="none" stroke="url(#gradient1)" stroke-width="6" stroke-dasharray="10 6"/>
      
      <text x="256" y="258" font-family="'Space Grotesk', 'Inter', sans-serif" font-weight="900" font-size="78" fill="#ffffff" text-anchor="middle">
        ${initials}
      </text>
      
      <path d="M 196,160 L 256,120 L 316,160" fill="none" stroke="#14F195" stroke-width="4" stroke-linecap="round"/>
      <path d="M 196,300 L 256,340 L 316,300" fill="none" stroke="#00C2FF" stroke-width="4" stroke-linecap="round"/>
      
      <text x="50%" y="420" font-family="'Space Grotesk', 'Inter', sans-serif" font-weight="700" font-size="14" fill="#ffffff" text-anchor="middle" letter-spacing="3">
        ${cleanPrompt.toUpperCase().substring(0, 30)}${cleanPrompt.length > 30 ? '...' : ''}
      </text>
      
      <text x="50%" y="455" font-family="monospace" font-size="11" fill="#14F195" text-anchor="middle" letter-spacing="1">
        VIBE ENGINE: HIGH-CONTRAST VECTOR
      </text>
    </svg>`;
  }

  const base64 = Buffer.from(svg).toString("base64");
  return `data:image/svg+xml;base64,${base64}`;
}

// Configure Vite or Static Assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Configurando middleware de Vite en desarrollo...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Configurando serving de archivos estáticos para producción...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor activo en http://0.0.0.0:${PORT}`);
  });
}

startServer();
