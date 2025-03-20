import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Funcție helper pentru formatarea feedback-ului
function formatFeedback(feedbackArray) {
  return feedbackArray.map(item => {
    // Împarte string-ul în două părți, folosind newline ca separator
    const parts = item.split("\n");
    const suggestion = parts[0];
    // Dacă există o explicație, elimină eventualul "-" de la început
    const explanation = parts[1] ? parts[1].trim().replace(/^-\s*/, "") : "";
    return `<p><strong>${suggestion}</strong></p>` + (explanation ? `<p>${explanation}</p>` : "");
  }).join('');
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { messages, course } = req.body;
  
  // Pentru prima interacțiune: generăm o frază în română fără traducere.
  if (course && !messages) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Ești un profesor de engleză. Generează o frază **în română**, potrivită pentru un student de nivel ${course}. 
Fraza trebuie să fie complexă și să nu includă traducerea.`,
          },
          { role: "user", content: "Generează o propoziție nouă în română." },
        ],
      });
      return res.status(200).json({ reply: { content: completion.choices[0].message.content, rawFeedback: "" } });
    } catch (error) {
      console.error("OpenAI API error:", error);
      return res.status(500).json({ error: error.message });
    }
  }
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Invalid messages format" });
  }
  
  try {
    // Definim funcția care va structura rezultatul corectării traducerii.
    const functions = [{
      name: "translation_correction",
      description: "Furnizează traducerea corectă completă în engleză și, dacă este cazul, un array de feedback care descrie diferențele între traducerea studentului și cea corectă.",
      parameters: {
        type: "object",
        properties: {
          correct_translation: {
            type: "string",
            description: "Textul complet al traducerii corecte în engleză."
          },
          feedback: {
            type: "array",
            items: { type: "string" },
            description: "Lista cu sugestii de corectare. Dacă traducerea studentului este identică, se va returna un array gol."
          }
        },
        required: ["correct_translation"]
      }
    }];
    
    // Actualizăm mesajul de sistem pentru a cere feedback strict bazat pe diferențele din traducerea studentului.
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Ești un profesor de engleză specializat în corectarea traducerilor. 
Folosind fraza originală (în limba română, prezentă în primul mesaj) ca referință, oferă traducerea corectă completă în limba engleză. 
Apoi, compară traducerea corectă cu traducerea trimisă de student (ultimul mesaj) și identifică fiecare greșeală explicită.

Pentru fiecare greșeală identificată, oferă un feedback clar și structurat, fiecare linie reprezentând un obiect distinct în array-ul "feedback". Formatul trebuie să fie:

\`"Cuvânt/Expresie greșită" ❌ → "Corectare" ✅\`
PE RAND NOU:
- Rând nou, formatat în HTML cu <p>: Explicația greșelii și motivul corectării, în limba română.

Exemplu:
\`"Today sun rises" ❌ → "Today, the sun is shining" ✅\`
PE RAND NOU:
- **"Sun"** are nevoie de **"the"** (pentru că este unică).  
- **"Rises"** înseamnă „răsare”, nu „strălucește”. Corect este **"is shining"**.  

\`"On the blue sky" ❌ → "In the blue sky" ✅\`
PE RAND NOU:
- În engleză, spunem **"in the sky"**, nu **"on the sky"**.

Dacă traducerea studentului este identică cu cea corectă, răspunde doar cu:
**"Traducerea este corectă. ✅"**

La răspuns, utilizează următorul format JSON:
{
  "correct_translation": "Textul complet al traducerii corecte în engleză.",
  "feedback": [
    "Cuvânt/Expresie greșită ❌ → Corectare ✅\\n- Explicația greșelii și motivul corectării.",
    "Altă greșeală ❌ → Corectare corectă ✅\\n- Explicația pentru această greșeală."
  ]
}

Asigură-te că fiecare element din array-ul "feedback" este o linie distinctă, iar explicațiile sunt clare și practice pentru fiecare corectare.`,
        },
        ...messages,
      ],
      functions,
      function_call: "auto"
    });
    
    const assistantMessage = completion.choices[0].message;
    
    // Dacă modelul nu a apelat funcția, încercăm să formateze totuși răspunsul în HTML.
    if (!assistantMessage.function_call) {
      const content = assistantMessage.content;
      try {
        // Căutăm un obiect JSON în text
        const jsonRegex = /{[\s\S]*}/;
        const match = content.match(jsonRegex);
        if (match) {
          const parsed = JSON.parse(match[0]);
          const correctTranslation = parsed.correct_translation;
          const feedbackArray = parsed.feedback || [];
          const finalTranslationHTML = `<p><strong>Correct translation:</strong></p>
<p>${correctTranslation}</p>
<hr>`;
          let feedbackHTML = "";
          if (feedbackArray.length > 0) {
            feedbackHTML = `<p><strong>Feedback:</strong></p>` + formatFeedback(feedbackArray);
          }
          const formattedHTML = `<div class="assistant-correction">
            ${finalTranslationHTML}
            ${feedbackHTML}
          </div>`;
          return res.status(200).json({ reply: { content: formattedHTML, rawFeedback: feedbackArray.join("\n") } });
        } else {
          // Dacă nu se găsește JSON, înfășurăm întregul text într-un container HTML
          const fallbackHTML = `<div class="assistant-correction"><p>${content}</p></div>`;
          return res.status(200).json({ reply: { content: fallbackHTML, rawFeedback: "" } });
        }
      } catch (err) {
        // În caz de eroare la parsare, returnăm textul brut înfășurat în HTML
        const fallbackHTML = `<div class="assistant-correction"><p>${content}</p></div>`;
        return res.status(200).json({ reply: { content: fallbackHTML, rawFeedback: "" } });
      }
    }
    
    // Ramura în care modelul a apelat funcția: procesăm datele structurate.
    const args = JSON.parse(assistantMessage.function_call.arguments);
    const correctTranslation = args.correct_translation;
    const feedbackArray = args.feedback || [];
    
    const finalTranslationHTML = `<p><strong>TRADUCEREA CORECTĂ:</strong></p>
<p>${correctTranslation}</p>
<hr>`;
    
    let feedbackHTML = "";
    if (feedbackArray.length > 0) {
      feedbackHTML = `<p><strong>FEEDBACK:</strong></p>` + formatFeedback(feedbackArray);
    }
    
    const formattedResponse = `
      <div class="assistant-correction">
        ${finalTranslationHTML}
        ${feedbackHTML}
      </div>
    `;
    
    const rawFeedbackText = feedbackArray.join("\n");
    
    return res.status(200).json({ reply: { content: formattedResponse, rawFeedback: rawFeedbackText } });
  } catch (error) {
    console.error("OpenAI API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
