const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const NodeCache = require("node-cache");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// In-memory cache (10 minutes TTL)
const cache = new NodeCache({ stdTTL: 600 }); // 500 seconds

const fetchCodeforcesContests = async () => {
  try {
    const { data } = await axios.get("https://codeforces.com/api/contest.list");
    return data.result
      .filter((contest) => contest.phase === "BEFORE")
      .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds)
      .map((contest) => ({
        name: contest.name,
        startTimeSeconds: contest.startTimeSeconds,
        durationSeconds: contest.durationSeconds,
        link: `https://codeforces.com/contest/${contest.id}`,
        platform: "Codeforces",
      }));
  } catch (error) {
    console.error("❌ Codeforces error:", error.message);
    return [];
  }
};

const fetchCodeChefContests = async () => {
  try {
    const { data } = await axios.get(
      "https://www.codechef.com/api/list/contests/all"
    );
    return data.future_contests.map((contest) => ({
      name: contest.contest_name,
      startTime: contest.start_date_iso,
      endTime: contest.end_date_iso,
      durationSeconds:
        (new Date(contest.end_date_iso) - new Date(contest.start_date_iso)) /
        1000,
      link: `https://www.codechef.com/${contest.contest_code}`,
      platform: "CodeChef",
    }));
  } catch (error) {
    console.error("❌ CodeChef error:", error.message);
    return [];
  }
};

const fetchAtCoderContests = async () => {
    try {
        const response = await axios.get("https://atcoder.jp/contests/");
        const html = response.data;
        const $ = cheerio.load(html);

        let contests = [];
        const currentTime = new Date(); // Current time in UTC

        // Select all contest rows from "Upcoming Contests" and "Running Contests" tables
        $(".table-default tbody tr").each((index, element) => {
            const name = $(element).find("td:nth-child(2) a").text().trim();
            const link = "https://atcoder.jp" + $(element).find("td:nth-child(2) a").attr("href");
            const rawTime = $(element).find("time").text().trim();  // "2024-10-04 19:00:00+0900"
            const formattedTime = rawTime.replace("+0900", "+09:00"); // Fix timezone format
            const dateObject = new Date(formattedTime);  // JavaScript Date object

            // ✅ Get duration from 3rd column
            const durationStr = $(element).find("td:nth-child(3)").text().trim(); // e.g. "02:00"
            const [hours, minutes] = durationStr.split(":").map(Number);
            const durationSeconds = (hours * 60 * 60) + (minutes * 60);

            // Only proceed if the date is valid and in the future or ongoing
            if (!isNaN(dateObject.getTime()) && dateObject >= currentTime) {
                // Format into DD/MM/YYYY, HH:mm:ss
                const formattedStartTime = dateObject.toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Tokyo", // AtCoder uses JST (UTC+9)
                }).replace(/,/, ', '); // Ensure consistent comma spacing

                contests.push({
                    name,
                    link,
                    contest_start_date: formattedStartTime, // Store in JST
                    durationSeconds
                });
            }
        });

        return contests.sort((a, b) => new Date(a.contest_start_date) - new Date(b.contest_start_date));
    } catch (error) {
        console.error("Error fetching AtCoder contests:", error);
        return [];
    }
};

app.get("/contests", async (req, res) => {
  const cached = cache.get("allContests");
  if (cached) {
    return res.json(cached);
  }

  try {
    const [codeforces, codechef, atcoder] = await Promise.all([
      fetchCodeforcesContests(),
      fetchCodeChefContests(),
      fetchAtCoderContests(),
    ]);

    const all = [...codeforces, ...codechef, ...atcoder].sort((a, b) => {
      const aTime = a.startTime || a.startTimeSeconds * 1000;
      const bTime = b.startTime || b.startTimeSeconds * 1000;
      return new Date(aTime) - new Date(bTime);
    });

    cache.set("allContests", all); // Cache results for 5 min
    res.json(all);
  } catch (err) {
    console.error("❌ Aggregation error:", err.message);
    res.status(500).json({ error: "Failed to fetch contests" });
  }
});


app.get("/", (req, res) => res.send("🚀 Contest Aggregator API is live!"));


app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
