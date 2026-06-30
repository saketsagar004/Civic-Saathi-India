import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API Routes
  app.post("/api/analyze", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "Missing imageBase64 in request body" });
        return;
      }

      const mimeTypeMatch = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!mimeTypeMatch) {
        res.status(400).json({ error: "Invalid image format. Expected data URL." });
        return;
      }
      const mimeType = mimeTypeMatch[1];
      const base64Data = mimeTypeMatch[2];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: "Analyze this image for a civic issue report. Identify the category (Road Damage / Pothole, Garbage / Illegal Dumping, Water Leakage / Drainage, Broken Streetlight, Crime / Obstruction, Other), severity level (Critical / High / Medium / Low), provide a short description, and suggest a broad generic department type (e.g., Public Works, Municipal Corporation, Jal Board, Electricity, Law & Enforcement, Other).",
          },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "One of: Road Damage / Pothole, Garbage / Illegal Dumping, Water Leakage / Drainage, Broken Streetlight, Crime / Obstruction, Other",
              },
              severity: {
                type: Type.STRING,
                description: "Critical, High, Medium, or Low",
              },
              description: {
                type: Type.STRING,
                description: "Short description of the issue in the photo",
              },
              department: {
                type: Type.STRING,
                description: "One of: Public Works, Municipal Corporation, Jal Board, Electricity, Law & Enforcement, Other",
              },
            },
            required: ["category", "severity", "description", "department"],
          },
        },
      });

      let jsonStr = response.text || "{}";
      const parsed = JSON.parse(jsonStr.trim());
      res.json(parsed);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to analyze image", details: error.message });
    }
  });

  app.post("/api/detect-department", async (req, res) => {
    try {
      const { addressDetails, category } = req.body;
      if (!addressDetails || !category) {
        res.status(400).json({ error: "Missing addressDetails or category" });
        return;
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: `The civic issue is located at: ${addressDetails}.
The issue type is: ${category}

Based on this specific location, identify:
1. The exact local government department responsible for this issue type in this city/district
2. The department's official name as used locally (e.g. in Mumbai it's BMC, in Delhi it's Municipal Corporation, in Bangalore it's BBMP)
3. Any publicly known contact information for this department

Return ONLY valid JSON. If you don't know the exact contact info, leave it as null.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              departmentName: { type: Type.STRING, description: "Full official name" },
              departmentShortName: { type: Type.STRING, description: "Abbreviation" },
              city: { type: Type.STRING },
              contactEmail: { type: Type.STRING, nullable: true },
              contactPhone: { type: Type.STRING, nullable: true },
              officialWebsite: { type: Type.STRING, nullable: true },
              note: { type: Type.STRING, description: "Any relevant info about this department" },
            },
            required: ["departmentName", "departmentShortName", "city", "note"],
          },
        },
      });

      let jsonStr = response.text || "{}";
      const parsed = JSON.parse(jsonStr.trim());
      res.json(parsed);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to detect department", details: error.message });
    }
  });

  app.post("/api/verify-resolution", async (req, res) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "Missing imageBase64" });
        return;
      }

      const mimeTypeMatch = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (!mimeTypeMatch) {
        res.status(400).json({ error: "Invalid image format" });
        return;
      }
      const mimeType = mimeTypeMatch[1];
      const base64Data = mimeTypeMatch[2];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: `Analyze this resolution photo carefully. 
1) Does this show a RESOLVED civic issue? Look for: repaired road surface, cleaned area, fixed streetlight, cleared drainage etc. 
2) Does this look AI-GENERATED or synthetic? Check for: unnaturally perfect textures, impossible lighting, watermarks, lack of real-world imperfections, too-clean surfaces.
3) Return valid JSON.`
          },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isResolved: { type: Type.BOOLEAN },
              isAIGenerated: { type: Type.BOOLEAN },
              resolutionConfidence: { type: Type.NUMBER },
              locationReasonable: { type: Type.BOOLEAN, description: "Does it look like a real outdoor/indoor civic location?" },
              reason: { type: Type.STRING },
            },
            required: ["isResolved", "isAIGenerated", "resolutionConfidence", "locationReasonable", "reason"],
          },
        },
      });

      let jsonStr = response.text || "{}";
      const parsed = JSON.parse(jsonStr.trim());
      res.json(parsed);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      res.status(500).json({ error: "Failed to verify resolution", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
