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
        mimeType: "image/png"
      });
    } else {
      res.status(500).json({ error: "No se pudo extraer la imagen del modelo de IA de Google." });
    }
  } catch (error: any) {
    console.error("Error al generar la imagen con Gemini:", error);
    res.status(500).json({
      error: error.message || "Error interno al invocar el motor de generación de imágenes.",
    });
  }
});

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
