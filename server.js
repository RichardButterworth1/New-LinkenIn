// server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Load PhantomBuster credentials from environment
const PHANTOMBUSTER_AGENT_ID = process.env.PHANTOMBUSTER_AGENT_ID;
const PHANTOMBUSTER_API_KEY = process.env.PHANTOMBUSTER_API_KEY;

// Endpoint to search LinkedIn profiles for given company (and optional job titles)
app.post('/search-profiles', async (req, res) => {
  try {
    const { company, titles } = req.body;
    if (!company) {
      return res.status(400).json({ error: "Company name is required" });
    }

    // Define the job titles to search for. Use provided titles or default to the four key titles.
    const jobTitles = Array.isArray(titles) && titles.length > 0 ? titles : [
      "Product Regulatory Manager",
      "Regulatory Compliance Director",
      "Product Stewardship Director",
      "Product Sustainability Director"
    ];

    // Construct LinkedIn people search query with boolean OR for multiple titles at the company
    const titlesQuery = jobTitles.map(title => `"${title}"`).join(" OR ");
    const searchKeywords = `(${titlesQuery}) "${company}"`;
    const encodedQuery = encodeURIComponent(searchKeywords);
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodedQuery}`;

    // Prepare PhantomBuster API request body with dynamic search URL
    const apiBody = {
      id: PHANTOMBUSTER_AGENT_ID,               // Phantom (agent) ID to launch
      arguments: { search: searchUrl }          // Override the search query with our dynamic URL
      // Note: Other required arguments (e.g., session cookie or identity) should be preset in the Phantom’s config.
      // We assume the Phantom is already configured with a LinkedIn session/identity.
    };

    // Launch the PhantomBuster agent (LinkedIn Search Export) via API
    const launchResp = await axios.post(
      'https://api.phantombuster.com/api/v2/agents/launch',
      apiBody,
      { headers: { 'Content-Type': 'application/json', 'X-Phantombuster-Key-1': PHANTOMBUSTER_API_KEY } }
    );
    // The launch request queues the Phantom; now we poll for results.

    let results = null;
    for (let attempt = 0; attempt < 30; attempt++) {  // poll up to ~60 seconds (30*2s)
      await new Promise(r => setTimeout(r, 2000));    // wait 2 seconds before each check

      const fetchResp = await axios.get(
        `https://api.phantombuster.com/api/v2/agents/fetch-output?id=${PHANTOMBUSTER_AGENT_ID}`,
        { headers: { 'X-Phantombuster-Key-1': PHANTOMBUSTER_API_KEY } }
      );
      const output = fetchResp.data;
      // If the Phantom has finished and returned data, it will appear in output.data
      if (output && output.data && Array.isArray(output.data)) {
        results = output.data;
        // We break out either when data is present (finished), or if status indicates completion
        if (results.length > 0 || output.status === "finished" || output.status === "error") {
          break;
        }
      }
    }

    if (!results) {
      // No results or Phantom did not finish in time
      return res.status(200).json({ profiles: [] });
    }

    // Transform the PhantomBuster output to a simplified list of profiles
    const profiles = results.map(item => {
      const name = item.fullName || `${item.firstName || ""} ${item.lastName || ""}`.trim();
      const title = item.jobTitle || item.subtitle || "";
      const profileUrl = item.profileUrl;
      return { name, title, profileUrl };
    });

    // Return the profiles as JSON
    res.status(200).json({ profiles });
  } catch (err) {
    console.error("Error during LinkedIn search:", err);
    res.status(500).json({ error: "Failed to retrieve LinkedIn profiles" });
  }
});

// Start the server on the port provided by Render or default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
