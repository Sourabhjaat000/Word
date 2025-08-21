// converter-extra.js

document.addEventListener("DOMContentLoaded", () => {
  const convertBtn = document.getElementById("convertBtn");
  const inputFile = document.getElementById("inputFile");
  const resultBox = document.getElementById("resultBox");

  // जब convert बटन क्लिक हो
  convertBtn.addEventListener("click", async () => {
    if (!inputFile.files.length) {
      alert("कृपया एक Word फ़ाइल चुनें!");
      return;
    }

    const file = inputFile.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      resultBox.innerText = "⏳ Converting...";

      // Backend API call (vercel api/convert.js को hit करेगा)
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Conversion failed!");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      // Download link create
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();

      resultBox.innerText = "✅ Conversion Successful! PDF Downloaded.";
    } catch (err) {
      console.error(err);
      resultBox.innerText = "❌ Error: Conversion Failed!";
    }
  });
});
