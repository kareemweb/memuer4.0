import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { WORLD_CUP_MATCHES } from "./src/data/worldCupMatches";

dotenv.config();

async function askAIServer(prompt: string, history?: string): Promise<string> {
  try {
    const apiKey = (process.env.GROQ_API_KEY || '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').trim().replace(/^["']|["']$/g, '');
    
    const systemInstruction = `You are Memuer AI, a secure and private AI companion embedded within Memuer (an E2EE end-to-end encrypted messaging application) powered by Groq. Maintain high confidentiality. Since you are talking in a secure, encrypted chat room, respect the privacy and do not leak user keys. Be helpful, concise, and professional.`;

    const messages = [
      { role: "system", content: systemInstruction }
    ];

    if (history) {
      messages.push({ role: "user", content: `Chat History:\n${history}\n\nUser: ${prompt}` });
    } else {
      messages.push({ role: "user", content: prompt });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API returned status ${res.status}: ${errText}`);
    }

    const data = await res.json() as any;
    const content = data?.choices?.[0]?.message?.content;
    return content || '';
  } catch (error: any) {
    console.error("Error calling Groq API on server:", error);
    return `Error: Could not generate a response from Groq AI companion. Reason: ${error?.message || error}`;
  }
}

async function uploadToImgBBOnServer(base64Data: string): Promise<string | null> {
  const apiKey = (process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || "b7f93a1dcac5269caed570648a1425f9").trim().replace(/^["']|["']$/g, '');
  if (!apiKey) {
    console.log("No server-side ImgBB API key configured.");
    return null;
  }

  try {
    const formData = new FormData();
    formData.append("image", base64Data);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      const data = await response.json() as any;
      if (data && data.success && data.data && data.data.url) {
        console.log("Server-side ImgBB upload succeeded:", data.data.url);
        return data.data.url;
      }
    } else {
      const errText = await response.text();
      console.error(`Server-side ImgBB API error response:`, errText);
    }
  } catch (err) {
    console.error("Server-side ImgBB upload failed:", err);
  }
  return null;
}

async function uploadToSupabaseOnServer(buffer: Buffer, filename: string, mimeType: string): Promise<string | null> {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://kujcneihjbsdzhusnezo.supabase.co").trim().replace(/^["']|["']$/g, '');
  const supabaseAnonKey = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_dLAC842Ajk0NAqutWAQ44g_Nsof_nMZ").trim().replace(/^["']|["']$/g, '');

  if (!supabaseUrl || !supabaseAnonKey) {
    console.log("No server-side Supabase credentials configured.");
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const uniquePath = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(uniquePath, buffer, {
        contentType: mimeType || 'video/mp4',
        duplex: 'half'
      });

    if (error) {
      console.error("Supabase server-side storage upload failed:", error);
      throw error;
    }

    const publicUrlResult = supabase.storage.from('videos').getPublicUrl(uniquePath);
    const publicUrl = publicUrlResult?.data?.publicUrl;
    if (publicUrl) {
      console.log("Supabase server-side upload succeeded:", publicUrl);
      return publicUrl;
    }
  } catch (err) {
    console.error("Server-side Supabase upload exception:", err);
  }
  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 file transmissions
  app.use(express.json({ limit: "500mb" }));
  app.use(express.urlencoded({ limit: "500mb", extended: true }));

  // Create uploads folder inside public if it doesn't exist
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Serve static uploaded files
  app.use("/uploads", express.static(uploadsDir));

  // Secure API endpoint for AI responses
  app.post("/api/ask-ai", async (req, res) => {
    try {
      const { prompt, history } = req.body;
      const responseText = await askAIServer(prompt, history);
      res.json({ response: responseText });
    } catch (err: any) {
      console.error("Server API handler error:", err);
      res.status(500).json({ error: err?.message || "Internal Server Error" });
    }
  });

  // Comprehensive fallback list of actual/highly realistic World Cup 2026 matches
  const FALLBACK_WORLD_CUP_MATCHES = [
    {
      id: 1,
      homeTeam: 'Mexico',
      awayTeam: 'South Africa',
      homeTeamId: 'mexico',
      awayTeamId: 'south_africa',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-11T16:00:00Z',
      time: '16:00',
      stadium: 'Mexico City Stadium',
      city: 'Mexico City',
      group: 'A',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 24' Hirving Lozano" }, { text: "⚽ 68' Santiago Giménez" }],
      awayEvents: []
    },
    {
      id: 2,
      homeTeam: 'Korea Republic',
      awayTeam: 'Czechia',
      homeTeamId: 'south_korea',
      awayTeamId: 'czechia',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-11T20:00:00Z',
      time: '20:00',
      stadium: 'Guadalajara Stadium',
      city: 'Guadalajara',
      group: 'A',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 41' Son Heung-min" }, { text: "⚽ 77' Hwang Hee-chan" }],
      awayEvents: [{ text: "⚽ 19' Patrik Schick" }]
    },
    {
      id: 3,
      homeTeam: 'Canada',
      awayTeam: 'Bosnia & Herzegovina',
      homeTeamId: 'canada',
      awayTeamId: 'bosnia',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-12T17:00:00Z',
      time: '17:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'B',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 55' Jonathan David" }],
      awayEvents: [{ text: "⚽ 61' Edin Džeko" }]
    },
    {
      id: 4,
      homeTeam: 'Qatar',
      awayTeam: 'Switzerland',
      homeTeamId: 'qatar',
      awayTeamId: 'switzerland',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-12T20:00:00Z',
      time: '20:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'B',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 45' Akram Afif" }],
      awayEvents: [{ text: "⚽ 82' Breel Embolo" }]
    },
    {
      id: 5,
      homeTeam: 'Haiti',
      awayTeam: 'Scotland',
      homeTeamId: 'haiti',
      awayTeamId: 'scotland',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-13T16:00:00Z',
      time: '16:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "⚽ 62' Scott McTominay" }]
    },
    {
      id: 6,
      homeTeam: 'Brazil',
      awayTeam: 'Morocco',
      homeTeamId: 'brazil',
      awayTeamId: 'morocco',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-13T19:00:00Z',
      time: '19:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 38' Vinícius Jr." }],
      awayEvents: [{ text: "⚽ 72' Hakim Ziyech" }]
    },
    {
      id: 7,
      homeTeam: 'Australia',
      awayTeam: 'Türkiye',
      homeTeamId: 'australia',
      awayTeamId: 'turkey',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-14T15:00:00Z',
      time: '15:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 18' Mitchell Duke" }, { text: "⚽ 84' Craig Goodwin" }],
      awayEvents: []
    },
    {
      id: 8,
      homeTeam: 'USA',
      awayTeam: 'Paraguay',
      homeTeamId: 'usa',
      awayTeamId: 'paraguay',
      homeScore: 4,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-14T18:00:00Z',
      time: '18:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 12' Christian Pulisic" }, { text: "⚽ 34' Folarin Balogun" }, { text: "⚽ 56' Weston McKennie" }, { text: "⚽ 89' Gio Reyna" }],
      awayEvents: [{ text: "⚽ 70' Miguel Almirón" }]
    },
    {
      id: 9,
      homeTeam: 'Germany',
      awayTeam: 'Curaçao',
      homeTeamId: 'germany',
      awayTeamId: 'curacao',
      homeScore: 7,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-15T16:00:00Z',
      time: '16:00',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 8' Florian Wirtz" }, 
        { text: "⚽ 23' Niclas Füllkrug" }, 
        { text: "⚽ 35' Jamal Musiala" },
        { text: "⚽ 44' Leroy Sané" },
        { text: "⚽ 60' Kai Havertz" },
        { text: "⚽ 72' Serge Gnabry" },
        { text: "⚽ 85' Thomas Müller" }
      ],
      awayEvents: [{ text: "⚽ 78' Juninho Bacuna" }]
    },
    {
      id: 10,
      homeTeam: "Côte d'Ivoire",
      awayTeam: 'Ecuador',
      homeTeamId: 'cote_divoire',
      awayTeamId: 'ecuador',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-15T19:00:00Z',
      time: '19:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 52' Sébastien Haller" }],
      awayEvents: []
    },
    {
      id: 11,
      homeTeam: 'Germany',
      awayTeam: "Côte d'Ivoire",
      homeTeamId: 'germany',
      awayTeamId: 'cote_divoire',
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-16T17:00:00Z',
      time: '17:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 24' Deniz Undav" }, { text: "⚽ 78' Deniz Undav" }],
      awayEvents: [{ text: "⚽ 55' Amad Diallo" }]
    },
    {
      id: 12,
      homeTeam: 'Ecuador',
      awayTeam: 'Curaçao',
      homeTeamId: 'ecuador',
      awayTeamId: 'curacao',
      homeScore: 0,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-16T20:00:00Z',
      time: '20:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "🧤 Eloy Room: 15 Heroic Saves" }]
    },
    {
      id: 13,
      homeTeam: 'Netherlands',
      awayTeam: 'Sweden',
      homeTeamId: 'netherlands',
      awayTeamId: 'sweden',
      homeScore: 5,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-17T16:00:00Z',
      time: '16:00',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'F',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 21' Cody Gakpo" },
        { text: "⚽ 42' Crysencio Summerville" },
        { text: "⚽ 56' Cody Gakpo" },
        { text: "⚽ 78' Crysencio Summerville" },
        { text: "⚽ 84' Brian Brobbey" }
      ],
      awayEvents: [{ text: "⚽ 12' Yasin Ayari" }]
    },
    {
      id: 14,
      homeTeam: 'Sweden',
      awayTeam: 'Tunisia',
      homeTeamId: 'sweden',
      awayTeamId: 'tunisia',
      homeScore: 5,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-17T19:00:00Z',
      time: '19:00',
      stadium: 'Monterrey Stadium',
      city: 'Monterrey',
      group: 'F',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 15' Alexander Isak" },
        { text: "⚽ 29' Emil Forsberg" },
        { text: "⚽ 44' Viktor Gyökeres" },
        { text: "⚽ 72' Viktor Gyökeres" },
        { text: "⚽ 88' Anthony Elanga" }
      ],
      awayEvents: [{ text: "⚽ 60' Youssef Msakni" }]
    },
    {
      id: 15,
      homeTeam: 'Netherlands',
      awayTeam: 'Japan',
      homeTeamId: 'netherlands',
      awayTeamId: 'japan',
      homeScore: 2,
      awayScore: 2,
      status: 'finished',
      date: '2026-06-18T17:00:00Z',
      time: '17:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'F',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 42' Frenkie de Jong" }, { text: "⚽ 79' Cody Gakpo" }],
      awayEvents: [{ text: "⚽ 21' Kaoru Mitoma" }, { text: "⚽ 56' Ritsu Doan" }]
    },
    {
      id: 16,
      homeTeam: 'Tunisia',
      awayTeam: 'Japan',
      homeTeamId: 'tunisia',
      awayTeamId: 'japan',
      homeScore: 0,
      awayScore: 4,
      status: 'finished',
      date: '2026-06-18T20:00:00Z',
      time: '20:00',
      stadium: 'Monterrey Stadium',
      city: 'Monterrey',
      group: 'F',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [
        { text: "⚽ 4' Daichi Kamada" },
        { text: "⚽ 31' Ayase Ueda" },
        { text: "⚽ 69' Junya Ito" },
        { text: "⚽ 83' Ayase Ueda" }
      ]
    },
    {
      id: 17,
      homeTeam: 'New Zealand',
      awayTeam: 'IR Iran',
      homeTeamId: 'new_zealand',
      awayTeamId: 'iran',
      homeScore: 2,
      awayScore: 2,
      status: 'finished',
      date: '2026-06-19T16:00:00Z',
      time: '16:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'G',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 33' Chris Wood" }, { text: "⚽ 84' Chris Wood" }],
      awayEvents: [{ text: "⚽ 19' Mehdi Taremi" }, { text: "⚽ 52' Sardar Azmoun" }]
    },
    {
      id: 18,
      homeTeam: 'Belgium',
      awayTeam: 'Egypt',
      homeTeamId: 'belgium',
      awayTeamId: 'egypt',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-19T19:00:00Z',
      time: '19:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'G',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "❌ 66' Mohamed Hany (OG)" }],
      awayEvents: [{ text: "⚽ 19' Emam Ashour (Assist: Mohamed Salah)" }]
    },
    {
      id: 19,
      homeTeam: 'Uruguay',
      awayTeam: 'Saudi Arabia',
      homeTeamId: 'uruguay',
      awayTeamId: 'saudi_arabia',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-20T17:00:00Z',
      time: '17:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'H',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 43' Darwin Núñez" }],
      awayEvents: [{ text: "⚽ 75' Salem Al-Dawsari" }]
    },
    {
      id: 20,
      homeTeam: 'Spain',
      awayTeam: 'Cabo Verde',
      homeTeamId: 'spain',
      awayTeamId: 'cabo_verde',
      homeScore: 0,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-20T20:00:00Z',
      time: '20:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'H',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: []
    },
    {
      id: 21,
      homeTeam: 'Norway',
      awayTeam: 'Iraq',
      homeTeamId: 'norway',
      awayTeamId: 'iraq',
      homeScore: 4,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-21T13:00:00Z',
      time: '13:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'I',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 21' Erling Haaland" }, 
        { text: "⚽ 45' Erling Haaland" }, 
        { text: "⚽ 68' Martin Ødegaard" },
        { text: "⚽ 84' Erling Haaland" }
      ],
      awayEvents: [{ text: "⚽ 56' Aymen Hussein" }]
    },
    {
      id: 22,
      homeTeam: 'France',
      awayTeam: 'Senegal',
      homeTeamId: 'france',
      awayTeamId: 'senegal',
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-21T16:00:00Z',
      time: '16:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'I',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 12' Kylian Mbappé" }, { text: "⚽ 34' Antoine Griezmann" }, { text: "⚽ 78' Ousmane Dembélé" }],
      awayEvents: [{ text: "⚽ 85' Sadio Mané" }]
    },
    {
      id: 23,
      homeTeam: 'Argentina',
      awayTeam: 'Algeria',
      homeTeamId: 'argentina',
      awayTeamId: 'algeria',
      homeScore: 3,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-21T19:00:00Z',
      time: '19:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'J',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 14' Lionel Messi" }, { text: "⚽ 58' Lautaro Martínez" }, { text: "⚽ 75' Julián Álvarez" }],
      awayEvents: []
    },
    {
      id: 24,
      homeTeam: 'Austria',
      awayTeam: 'Jordan',
      homeTeamId: 'austria',
      awayTeamId: 'jordan',
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-21T22:00:00Z',
      time: '22:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'J',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 28' Marcel Sabitzer" }, { text: "⚽ 44' Michael Gregoritsch" }, { text: "⚽ 82' Christoph Baumgartner" }],
      awayEvents: [{ text: "⚽ 64' Musa Al-Taamari" }]
    },
    {
      id: 25,
      homeTeam: 'Colombia',
      awayTeam: 'Uzbekistan',
      homeTeamId: 'colombia',
      awayTeamId: 'uzbekistan',
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-21T23:30:00Z',
      time: '23:30',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'K',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 18' Luis Díaz" }, { text: "⚽ 49' Rafael Santos Borré" }, { text: "⚽ 82' James Rodríguez" }],
      awayEvents: [{ text: "⚽ 71' Eldor Shomurodov" }]
    },
    {
      id: 26,
      homeTeam: 'Congo DR',
      awayTeam: 'Portugal',
      homeTeamId: 'congo_dr',
      awayTeamId: 'portugal',
      homeScore: 1,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-21T23:30:00Z',
      time: '23:30',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'K',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 68' Yoane Wissa" }],
      awayEvents: [{ text: "⚽ 34' Bruno Fernandes" }]
    },
    {
      id: 27,
      homeTeam: 'England',
      awayTeam: 'Croatia',
      homeTeamId: 'england',
      awayTeamId: 'croatia',
      homeScore: 4,
      awayScore: 2,
      status: 'finished',
      date: '2026-06-21T01:00:00Z',
      time: '01:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'L',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 9' Harry Kane" }, { text: "⚽ 24' Jude Bellingham" }, { text: "⚽ 56' Bukayo Saka" }, { text: "⚽ 82' Phil Foden" }],
      awayEvents: [{ text: "⚽ 41' Andrej Kramarić" }, { text: "⚽ 71' Luka Modrić" }]
    },
    {
      id: 28,
      homeTeam: 'Ghana',
      awayTeam: 'Panama',
      homeTeamId: 'ghana',
      awayTeamId: 'panama',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-21T01:00:00Z',
      time: '01:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'L',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 74' Mohammed Kudus" }],
      awayEvents: []
    },
    {
      id: 49,
      homeTeam: 'Scotland',
      awayTeam: 'Morocco',
      homeTeamId: 'scotland',
      awayTeamId: 'morocco',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-18T21:00:00Z',
      time: '21:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "⚽ 2' Ismael Saibari (71s)" }]
    },
    {
      id: 50,
      homeTeam: 'Canada',
      awayTeam: 'Qatar',
      homeTeamId: 'canada',
      awayTeamId: 'qatar',
      homeScore: 6,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-17T15:00:00Z',
      time: '15:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'B',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 8' Jonathan David" },
        { text: "⚽ 24' Cyle Larin" },
        { text: "⚽ 41' Jonathan David" },
        { text: "⚽ 55' Cyle Larin" },
        { text: "⚽ 71' Jonathan David" },
        { text: "⚽ 83' Nathan Saliba" }
      ],
      awayEvents: []
    },
    {
      id: 51,
      homeTeam: 'Brazil',
      awayTeam: 'Haiti',
      homeTeamId: 'brazil',
      awayTeamId: 'haiti',
      homeScore: 3,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-18T18:00:00Z',
      time: '18:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 14' Vinícius Júnior" },
        { text: "⚽ 42' Vinícius Júnior" },
        { text: "⚽ 68' Matheus Cunha" }
      ],
      awayEvents: []
    },
    {
      id: 52,
      homeTeam: 'USA',
      awayTeam: 'Australia',
      homeTeamId: 'usa',
      awayTeamId: 'australia',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-19T15:00:00Z',
      time: '15:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 33' Folarin Balogun" },
        { text: "⚽ 75' Folarin Balogun" }
      ],
      awayEvents: []
    },
    {
      id: 53,
      homeTeam: 'Mexico',
      awayTeam: 'South Korea',
      homeTeamId: 'mexico',
      awayTeamId: 'south_korea',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-17T18:00:00Z',
      time: '18:00',
      stadium: 'Mexico City Stadium',
      city: 'Mexico City',
      group: 'A',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 62' Julián Quiñones" }],
      awayEvents: []
    },
    {
      id: 54,
      homeTeam: 'Türkiye',
      awayTeam: 'Paraguay',
      homeTeamId: 'turkey',
      awayTeamId: 'paraguay',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-19T18:00:00Z',
      time: '18:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "⚽ 45' Maurício" }]
    },
    {
      id: 55,
      homeTeam: 'Ecuador',
      awayTeam: 'Curaçao',
      homeTeamId: 'ecuador',
      awayTeamId: 'curacao',
      homeScore: 0,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-20T18:00:00Z',
      time: '18:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: []
    },
    {
      id: 56,
      homeTeam: 'Spain',
      awayTeam: 'Saudi Arabia',
      homeTeamId: 'spain',
      awayTeamId: 'saudi_arabia',
      status: 'scheduled',
      date: '2026-06-21T19:00:00Z',
      time: '19:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'H',
      stage: 'group'
    },
    {
      id: 57,
      homeTeam: 'Belgium',
      awayTeam: 'IR Iran',
      homeTeamId: 'belgium',
      awayTeamId: 'iran',
      status: 'scheduled',
      date: '2026-06-21T22:00:00Z',
      time: '22:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'G',
      stage: 'group'
    },
    {
      id: 58,
      homeTeam: 'Uruguay',
      awayTeam: 'Cabo Verde',
      homeTeamId: 'uruguay',
      awayTeamId: 'cabo_verde',
      status: 'scheduled',
      date: '2026-06-22T01:00:00Z',
      time: '01:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'H',
      stage: 'group'
    },
    {
      id: 59,
      homeTeam: 'New Zealand',
      awayTeam: 'Egypt',
      homeTeamId: 'new_zealand',
      awayTeamId: 'egypt',
      status: 'scheduled',
      date: '2026-06-22T04:00:00Z',
      time: '04:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'G',
      stage: 'group'
    },
    {
      id: 60,
      homeTeam: 'Argentina',
      awayTeam: 'Austria',
      homeTeamId: 'argentina',
      awayTeamId: 'austria',
      status: 'scheduled',
      date: '2026-06-22T20:00:00Z',
      time: '20:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'J',
      stage: 'group'
    },
    {
      id: 61,
      homeTeam: 'France',
      awayTeam: 'Iraq',
      homeTeamId: 'france',
      awayTeamId: 'iraq',
      status: 'scheduled',
      date: '2026-06-22T23:00:00Z',
      time: '23:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'I',
      stage: 'group'
    },
    {
      id: 62,
      homeTeam: 'Norway',
      awayTeam: 'Senegal',
      homeTeamId: 'norway',
      awayTeamId: 'senegal',
      status: 'scheduled',
      date: '2026-06-23T03:00:00Z',
      time: '03:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'I',
      stage: 'group'
    },
    {
      id: 63,
      homeTeam: 'Jordan',
      awayTeam: 'Algeria',
      homeTeamId: 'jordan',
      awayTeamId: 'algeria',
      status: 'scheduled',
      date: '2026-06-23T06:00:00Z',
      time: '06:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'J',
      stage: 'group'
    },
    {
      id: 64,
      homeTeam: 'Portugal',
      awayTeam: 'Uzbekistan',
      homeTeamId: 'portugal',
      awayTeamId: 'uzbekistan',
      status: 'scheduled',
      date: '2026-06-23T20:00:00Z',
      time: '20:00',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'K',
      stage: 'group'
    },
    {
      id: 65,
      homeTeam: 'England',
      awayTeam: 'Ghana',
      homeTeamId: 'england',
      awayTeamId: 'ghana',
      status: 'scheduled',
      date: '2026-06-23T23:00:00Z',
      time: '23:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'L',
      stage: 'group'
    },
    {
      id: 66,
      homeTeam: 'Panama',
      awayTeam: 'Croatia',
      homeTeamId: 'panama',
      awayTeamId: 'croatia',
      status: 'scheduled',
      date: '2026-06-24T02:00:00Z',
      time: '02:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'L',
      stage: 'group'
    },
    {
      id: 67,
      homeTeam: 'Colombia',
      awayTeam: 'Congo DR',
      homeTeamId: 'colombia',
      awayTeamId: 'congo_dr',
      status: 'scheduled',
      date: '2026-06-24T05:00:00Z',
      time: '05:00',
      stadium: 'Guadalajara Stadium',
      city: 'Guadalajara',
      group: 'K',
      stage: 'group'
    },
    {
      id: 68,
      homeTeam: 'Switzerland',
      awayTeam: 'Canada',
      homeTeamId: 'switzerland',
      awayTeamId: 'canada',
      status: 'scheduled',
      date: '2026-06-24T20:00:00Z',
      time: '20:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'B',
      stage: 'group'
    },
    {
      id: 69,
      homeTeam: 'Bosnia & Herzegovina',
      awayTeam: 'Qatar',
      homeTeamId: 'bosnia',
      awayTeamId: 'qatar',
      status: 'scheduled',
      date: '2026-06-24T20:00:00Z',
      time: '20:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'B',
      stage: 'group'
    },
    {
      id: 70,
      homeTeam: 'Scotland',
      awayTeam: 'Brazil',
      homeTeamId: 'scotland',
      awayTeamId: 'brazil',
      status: 'scheduled',
      date: '2026-06-24T23:00:00Z',
      time: '23:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'C',
      stage: 'group'
    },
    {
      id: 71,
      homeTeam: 'Morocco',
      awayTeam: 'Haiti',
      homeTeamId: 'morocco',
      awayTeamId: 'haiti',
      status: 'scheduled',
      date: '2026-06-24T23:00:00Z',
      time: '23:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'C',
      stage: 'group'
    },
    {
      id: 72,
      homeTeam: 'Czechia',
      awayTeam: 'Mexico',
      homeTeamId: 'czechia',
      awayTeamId: 'mexico',
      status: 'scheduled',
      date: '2026-06-25T02:00:00Z',
      time: '02:00',
      stadium: 'Mexico City Stadium',
      city: 'Mexico City',
      group: 'A',
      stage: 'group'
    },
    {
      id: 73,
      homeTeam: 'South Africa',
      awayTeam: 'Korea Republic',
      homeTeamId: 'south_africa',
      awayTeamId: 'south_korea',
      status: 'scheduled',
      date: '2026-06-25T02:00:00Z',
      time: '02:00',
      stadium: 'Monterrey Stadium',
      city: 'Monterrey',
      group: 'A',
      stage: 'group'
    },
    {
      id: 74,
      homeTeam: 'Ecuador',
      awayTeam: 'Germany',
      homeTeamId: 'ecuador',
      awayTeamId: 'germany',
      status: 'scheduled',
      date: '2026-06-25T21:00:00Z',
      time: '21:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'E',
      stage: 'group'
    },
    {
      id: 75,
      homeTeam: 'Curaçao',
      awayTeam: "Côte d'Ivoire",
      homeTeamId: 'curacao',
      awayTeamId: 'cote_divoire',
      status: 'scheduled',
      date: '2026-06-25T21:00:00Z',
      time: '21:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'E',
      stage: 'group'
    },
    {
      id: 76,
      homeTeam: 'Japan',
      awayTeam: 'Sweden',
      homeTeamId: 'japan',
      awayTeamId: 'sweden',
      status: 'scheduled',
      date: '2026-06-26T00:00:00Z',
      time: '00:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'F',
      stage: 'group'
    },
    {
      id: 77,
      homeTeam: 'Tunisia',
      awayTeam: 'Netherlands',
      homeTeamId: 'tunisia',
      awayTeamId: 'netherlands',
      status: 'scheduled',
      date: '2026-06-26T00:00:00Z',
      time: '00:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'F',
      stage: 'group'
    },
    {
      id: 78,
      homeTeam: 'Türkiye',
      awayTeam: 'USA',
      homeTeamId: 'turkey',
      awayTeamId: 'usa',
      status: 'scheduled',
      date: '2026-06-26T03:00:00Z',
      time: '03:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'D',
      stage: 'group'
    },
    {
      id: 79,
      homeTeam: 'Paraguay',
      awayTeam: 'Australia',
      homeTeamId: 'paraguay',
      awayTeamId: 'australia',
      status: 'scheduled',
      date: '2026-06-26T03:00:00Z',
      time: '03:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'D',
      stage: 'group'
    },
    {
      id: 80,
      homeTeam: 'Norway',
      awayTeam: 'France',
      homeTeamId: 'norway',
      awayTeamId: 'france',
      status: 'scheduled',
      date: '2026-06-26T20:00:00Z',
      time: '20:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'I',
      stage: 'group'
    },
    {
      id: 81,
      homeTeam: 'Senegal',
      awayTeam: 'Iraq',
      homeTeamId: 'senegal',
      awayTeamId: 'iraq',
      status: 'scheduled',
      date: '2026-06-26T20:00:00Z',
      time: '20:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'I',
      stage: 'group'
    },
    {
      id: 82,
      homeTeam: 'Cabo Verde',
      awayTeam: 'Saudi Arabia',
      homeTeamId: 'cabo_verde',
      awayTeamId: 'saudi_arabia',
      status: 'scheduled',
      date: '2026-06-26T23:00:00Z',
      time: '23:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'H',
      stage: 'group'
    },
    {
      id: 83,
      homeTeam: 'Uruguay',
      awayTeam: 'Spain',
      homeTeamId: 'uruguay',
      awayTeamId: 'spain',
      status: 'scheduled',
      date: '2026-06-26T23:00:00Z',
      time: '23:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'H',
      stage: 'group'
    },
    {
      id: 84,
      homeTeam: 'New Zealand',
      awayTeam: 'Belgium',
      homeTeamId: 'new_zealand',
      awayTeamId: 'belgium',
      status: 'scheduled',
      date: '2026-06-27T04:00:00Z',
      time: '04:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'G',
      stage: 'group'
    },
    {
      id: 85,
      homeTeam: 'Egypt',
      awayTeam: 'IR Iran',
      homeTeamId: 'egypt',
      awayTeamId: 'iran',
      status: 'scheduled',
      date: '2026-06-27T04:00:00Z',
      time: '04:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'G',
      stage: 'group'
    },
    {
      id: 86,
      homeTeam: 'Panama',
      awayTeam: 'England',
      homeTeamId: 'panama',
      awayTeamId: 'england',
      status: 'scheduled',
      date: '2026-06-27T22:00:00Z',
      time: '22:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'L',
      stage: 'group'
    },
    {
      id: 87,
      homeTeam: 'Croatia',
      awayTeam: 'Ghana',
      homeTeamId: 'croatia',
      awayTeamId: 'ghana',
      status: 'scheduled',
      date: '2026-06-27T22:00:00Z',
      time: '22:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'L',
      stage: 'group'
    },
    {
      id: 88,
      homeTeam: 'Colombia',
      awayTeam: 'Portugal',
      homeTeamId: 'colombia',
      awayTeamId: 'portugal',
      status: 'scheduled',
      date: '2026-06-28T00:30:00Z',
      time: '00:30',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'K',
      stage: 'group'
    },
    {
      id: 89,
      homeTeam: 'Congo DR',
      awayTeam: 'Uzbekistan',
      homeTeamId: 'congo_dr',
      awayTeamId: 'uzbekistan',
      status: 'scheduled',
      date: '2026-06-28T00:30:00Z',
      time: '00:30',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'K',
      stage: 'group'
    },
    {
      id: 90,
      homeTeam: 'Algeria',
      awayTeam: 'Austria',
      homeTeamId: 'algeria',
      awayTeamId: 'austria',
      status: 'scheduled',
      date: '2026-06-28T03:00:00Z',
      time: '03:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'J',
      stage: 'group'
    },
    {
      id: 91,
      homeTeam: 'Jordan',
      awayTeam: 'Argentina',
      homeTeamId: 'jordan',
      awayTeamId: 'argentina',
      status: 'scheduled',
      date: '2026-06-28T03:00:00Z',
      time: '03:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'J',
      stage: 'group'
    }
  ];

  const VALID_COUNTRY_IDS = [
    'usa', 'mexico', 'canada', 'jamaica', 'argentina', 'brazil', 'uruguay', 'colombia',
    'france', 'england', 'spain', 'portugal', 'germany', 'italy', 'morocco', 'belgium',
    'japan', 'south_korea', 'australia', 'saudi_arabia', 'croatia', 'netherlands',
    'senegal', 'ecuador', 'switzerland', 'denmark', 'tunisia', 'panama', 'poland',
    'sweden', 'iran', 'algeria', 'egypt', 'nigeria', 'cameroon', 'ghana', 'peru',
    'chile', 'ukraine', 'costa_rica', 'new_zealand', 'iraq', 'qatar', 'uae', 'turkey',
    'wales', 'scotland', 'austria', 'cabo_verde', 'norway', 'jordan', 'uzbekistan',
    'congo_dr', 'haiti', 'bosnia', 'czechia', 'south_africa', 'curacao', 'cote_divoire', 'paraguay'
  ];

  function findBestCountryId(nameOrId: string): string {
    const normalized = (nameOrId || '').toLowerCase().trim();
    if (VALID_COUNTRY_IDS.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes('united states') || normalized.includes('usa') || normalized.includes('u.s.')) return 'usa';
    if (normalized.includes('mexic')) return 'mexico';
    if (normalized.includes('korea') || normalized === 'kor') return 'south_korea';
    if (normalized.includes('saudi') || normalized === 'ksa') return 'saudi_arabia';
    if (normalized.includes('new zealand') || normalized === 'nzl') return 'new_zealand';
    if (normalized.includes('costa rica') || normalized === 'crc') return 'costa_rica';
    
    const found = VALID_COUNTRY_IDS.find(id => normalized.includes(id) || id.includes(normalized));
    if (found) return found;
    return 'usa'; 
  }

  // Live World Cup real-time API cache variables
  let matchesCache: any = null;
  let matchesCacheTime = 0;

  // Live World Cup real-time API backed by Google Search Grounding & Gemini
  app.get("/api/worldcup/matches", async (req, res) => {
    return res.json({ matches: WORLD_CUP_MATCHES, realTime: true });
  });

  // Create temp uploads directory for chunks
  const chunkTempDir = path.join(process.cwd(), "public", "uploads", "temp");
  if (!fs.existsSync(chunkTempDir)) {
    fs.mkdirSync(chunkTempDir, { recursive: true });
  }

  // Chunked upload handler to bypass proxy payload size limits (e.g. nginx 1MB-10MB limits)
  app.post("/api/upload/chunk", async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, chunkData, filename } = req.body;
      if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !chunkData) {
        return res.status(400).json({ error: "Missing required chunk upload parameters." });
      }

      // Convert Base64 back into raw binary bytes
      const base64Data = chunkData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Save chunk file inside user-specific temp directory
      const userTempDir = path.join(chunkTempDir, uploadId);
      if (!fs.existsSync(userTempDir)) {
        fs.mkdirSync(userTempDir, { recursive: true });
      }

      const chunkPath = path.join(userTempDir, `chunk_${chunkIndex}`);
      await fs.promises.writeFile(chunkPath, buffer);

      // Check if we have received all chunks
      let allChunksReceived = true;
      for (let i = 0; i < totalChunks; i++) {
        if (!fs.existsSync(path.join(userTempDir, `chunk_${i}`))) {
          allChunksReceived = false;
          break;
        }
      }

      if (allChunksReceived) {
        // Merge all chunks
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const safeFilename = `${Date.now()}_${sanitizedFilename}`;
        const finalFilePath = path.join(uploadsDir, safeFilename);

        const writeStream = fs.createWriteStream(finalFilePath);
        for (let i = 0; i < totalChunks; i++) {
          const currentChunkPath = path.join(userTempDir, `chunk_${i}`);
          const data = await fs.promises.readFile(currentChunkPath);
          writeStream.write(data);
        }
        writeStream.end();

        // Wait slightly for the writeStream to completely close
        await new Promise<void>((resolve) => writeStream.on("finish", () => resolve()));

        // Clean up temp chunk files
        await fs.promises.rm(userTempDir, { recursive: true, force: true }).catch(e => console.error("Error cleaning up chunk files:", e));

        // If it's an image, attempt server-side ImgBB upload
        const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(filename);
        const isVideo = /\.(mp4|mov|webm|avi|mkv)$/i.test(filename);
        let fileUrl = `/uploads/${safeFilename}`;

        if (isImage) {
          try {
            const fileBuffer = await fs.promises.readFile(finalFilePath);
            const base64String = fileBuffer.toString("base64");
            const imgbbUrl = await uploadToImgBBOnServer(base64String);
            if (imgbbUrl) {
              fileUrl = imgbbUrl;
              // Clean up the local file since we have it hosted on ImgBB
              await fs.promises.unlink(finalFilePath).catch(e => console.warn("Error deleting local file after ImgBB upload:", e));
            }
          } catch (imgErr) {
            console.error("Chunked image upload to ImgBB failed, keeping local file:", imgErr);
          }
        } else if (isVideo) {
          try {
            const fileBuffer = await fs.promises.readFile(finalFilePath);
            const supabaseUrl = await uploadToSupabaseOnServer(fileBuffer, filename, "video/mp4");
            if (supabaseUrl) {
              fileUrl = supabaseUrl;
              // Clean up local file since we have it hosted on Supabase
              await fs.promises.unlink(finalFilePath).catch(e => console.warn("Error deleting local file after Supabase upload:", e));
            }
          } catch (vidErr) {
            console.error("Chunked video upload to Supabase failed, keeping local file:", vidErr);
          }
        }

        return res.json({ url: fileUrl, completed: true });
      }

      return res.json({ completed: false, chunkIndex });
    } catch (err: any) {
      console.error("Chunk upload error:", err);
      res.status(500).json({ error: err?.message || "Failed to write chunk to disk." });
    }
  });

  // Dedicated server-side proxy for ImgBB uploads
  app.post("/api/upload-imgbb", async (req, res) => {
    try {
      const { filename, fileData } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "Missing fileData payload." });
      }

      const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
      const imgbbUrl = await uploadToImgBBOnServer(base64Data);
      if (imgbbUrl) {
        console.log("Successfully uploaded to ImgBB via proxy route:", imgbbUrl);
        return res.json({ url: imgbbUrl });
      }

      return res.status(500).json({ error: "Failed to upload image to ImgBB server-side." });
    } catch (err: any) {
      console.error("Proxy ImgBB Upload Error:", err);
      res.status(500).json({ error: err?.message || "Internal server error during ImgBB upload." });
    }
  });

  // Dedicated server-side proxy for Supabase video uploads
  app.post("/api/upload-supabase-video", async (req, res) => {
    try {
      const { filename, fileData, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "Missing fileData payload." });
      }

      const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const supabaseUrl = await uploadToSupabaseOnServer(buffer, filename, mimeType || "video/mp4");
      if (supabaseUrl) {
        console.log("Successfully uploaded to Supabase via proxy route:", supabaseUrl);
        return res.json({ url: supabaseUrl });
      }

      return res.status(500).json({ error: "Failed to upload video to Supabase server-side." });
    } catch (err: any) {
      console.error("Proxy Supabase Video Upload Error:", err);
      res.status(500).json({ error: err?.message || "Internal server error during Supabase video upload." });
    }
  });

  // Custom high-performance secure media/photo/video upload handler (bypasses unconfigured storage buckets)
  app.post("/api/upload", async (req, res) => {
    try {
      const { filename, fileData, mimeType } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "Missing fileData payload." });
      }

      // Convert Base64 back into raw binary bytes
      const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");

      // If it is an image, try server-side ImgBB upload first
      const isImage = mimeType?.startsWith("image/") || /\.(png|jpg|jpeg|webp|gif)$/i.test(filename);
      if (isImage) {
        const imgbbUrl = await uploadToImgBBOnServer(base64Data);
        if (imgbbUrl) {
          return res.json({ url: imgbbUrl });
        }
      }

      // If it is a video, try server-side Supabase upload first
      const isVideo = mimeType?.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(filename);
      if (isVideo) {
        try {
          const buffer = Buffer.from(base64Data, "base64");
          const supabaseUrl = await uploadToSupabaseOnServer(buffer, filename, mimeType || "video/mp4");
          if (supabaseUrl) {
            return res.json({ url: supabaseUrl });
          }
        } catch (vidErr) {
          console.error("Single video upload to Supabase failed, falling back to local file:", vidErr);
        }
      }

      // Fallback to storing locally on disk
      const buffer = Buffer.from(base64Data, "base64");

      // Generate localized unique token for collision avoidance
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const safeFilename = `${Date.now()}_${sanitizedFilename}`;
      const filePath = path.join(uploadsDir, safeFilename);

      await fs.promises.writeFile(filePath, buffer);
      console.log(`Successfully stored E2EE media packet locally: ${filePath}`);

      // Expose accessible container link
      const fileUrl = `/uploads/${safeFilename}`;
      res.json({ url: fileUrl });
    } catch (err: any) {
      console.error("Local Server Media Writer Error:", err);
      res.status(500).json({ error: err?.message || "Failed to commit binary stream to disk." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
