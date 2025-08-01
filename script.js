console.log("✅ Script loaded!");

document.getElementById("search-button").addEventListener("click", async function (e) {
  e.preventDefault();

  const from = document.getElementById("from").value.trim().toUpperCase();
  const to = document.getElementById("to").value.trim().toUpperCase();
  const departureDate = document.getElementById("departure-date").value;
  const returnDate = document.getElementById("return-date").value;
  const passengers = document.getElementById("passengers").value || "1";
  const travelClass = document.getElementById("travel-class").value;
  const tripType = document.querySelector('input[name="trip-type"]:checked')?.value || "one-way";

  const searchData = {
    from,
    to,
    departureDate,
    returnDate,
    passengers,
    travelClass,
    tripType
  };

  console.log("🔍 Sending search request:", searchData);

  try {
    const response = await fetch("https://skydeal-backend.onrender.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(searchData)
    });

    const data = await response.json();

    console.log("🎯 Flight Results:", data);

    // Clear existing results
    document.getElementById("outbound-results").innerHTML = "";
    document.getElementById("return-results").innerHTML = "";

    // Display outbound flights
    data.outbound.forEach(flight => {
      const div = document.createElement("div");
      div.className = "flight-card";
      div.textContent = `${flight.flightNumber} | ${flight.airline} | ${flight.departureTime} - ${flight.arrivalTime} | ₹${flight.price}`;
      document.getElementById("outbound-results").appendChild(div);
    });

    // Display return flights (if present)
    if (Array.isArray(data.return)) {
      data.return.forEach(flight => {
        const div = document.createElement("div");
        div.className = "flight-card";
        div.textContent = `${flight.flightNumber} | ${flight.airline} | ${flight.departureTime} - ${flight.arrivalTime} | ₹${flight.price}`;
        document.getElementById("return-results").appendChild(div);
      });
    }

  } catch (error) {
    console.error("❌ Error fetching flights:", error);
    alert("Something went wrong while fetching flights.");
  }
});
