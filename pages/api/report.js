import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { aggregatedFeedback } = req.body;
  if (!aggregatedFeedback) {
    return res.status(400).json({ error: "No feedback provided" });
  }
  
  try {
    const prompt = `Te rog să generezi un raport de corecție a traducerilor în format HTML, respectând exact următoarea structură și oferind soluții concrete:

<p><strong>Raport de corecție a traducerilor:</strong></p>
<div>
  <p><strong>Probleme identificate:</strong></p>
  <p>1. Greșeli gramaticale:</p>
  <ul>
     <li>- [Problema 1 pentru greșeli gramaticale]</li>
     <li>- [Problema 2 pentru greșeli gramaticale]</li>
  </ul>
  <p>2. Greșeli de vocabular:</p>
  <ul>
     <li>- [Problema 1 pentru greșeli de vocabular]</li>
  </ul>
</div>

<div>
  <p><strong>Soluții propuse:</strong></p>
  <div>
    <p>1. Pentru greșeli gramaticale:</p>
    <ul>
       <li>- [Soluție concretă pentru greșeli gramaticale]</li>
       <li>- [Altă soluție concretă pentru greșeli gramaticale]</li>
    </ul>
    <p>2. Pentru greșeli de vocabular:</p>
    <ul>
       <li>- [Soluție concretă pentru greșeli de vocabular]</li>
    </ul>
  </div>
</div>

<div>
  <p><strong>Sfat general:</strong></p>
  <ul>
     <li>- [Soluție/temă generală concretă]</li>
  </ul>
</div>

Folosind următoarele feedback-uri agregate:
${aggregatedFeedback}

Generează un raport generalizat care să sintetizeze problemele întâlnite și să ofere soluții concrete și teme de studiu pentru fiecare categorie de erori.
Asigură-te că secțiunea "Sfat general" apare o singură dată, fără repetări, iar fiecare soluție/temă este menționată o singură dată.
Răspunsul trebuie să fie valid HTML conform structurii de mai sus.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
         { role: "system", content: "Ești un expert în limba engleză și oferi rapoarte concise și concrete." },
         { role: "user", content: prompt }
      ]
    });
    
    const report = completion.choices[0].message.content;
    return res.status(200).json({ report });
  } catch (error) {
    console.error("Report API error:", error);
    return res.status(500).json({ error: error.message });
  }
}
