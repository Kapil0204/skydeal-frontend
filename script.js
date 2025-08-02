document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("search-btn");
  const returnDateGroup = document.getElementById("return-date-group");

  // Toggle return date field
  document.querySelectorAll('input[name="tripType"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      returnDateGroup.style.display =
        document.getElementById("round-trip").checked ? "block" : "none";
    });
  });

  searchBtn.addEventListener("click", async () => {
    const from = document.getElementById("from").value.trim();
    const to = document.getElementById("to").value.trim();
    const departureDate = document.getElementById("departure-date").value;
    const returnDate = document.getElementById("return-date").value;
    const passengers = document.getElementById("passengers").value || "1";
    const travelClass = document.getElementById("travel-class").value;
    const tripType = document.getElementById("round-trip").checked ? "round-trip" : "one-way";

    const requestBody = {
      from,
      to,
      departureDate,
      returnDate: tripType === "round-trip" ? returnDate : "",
      passengers,
      travelClass,
      tripType
    };

    try {
      const res = await fetch("https://skydeal-backend.onrender.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json();

      console.log("Real flights fetched:", data);
      // Render flights logic goes here...

    } catch (error) {
      console.error("Error fetching flights:", error);
    }
  });
});
