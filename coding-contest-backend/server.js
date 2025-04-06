const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Fetch contests from Codeforces
const fetchCodeforcesContests = async () => {
    try {
        const response = await axios.get("https://codeforces.com/api/contest.list");
        const upcoming = response.data.result
            .filter(contest => contest.phase === "BEFORE")
            .sort((a, b) => a.startTimeSeconds - b.startTimeSeconds); // ascending order

        const contests = upcoming.map(contest => ({
            ...contest,
            link: `https://codeforces.com/contests/${contest.id}`,
        }));

        return contests;
    } catch (error) {
        console.error("Error fetching Codeforces contests:", error);
        return [];
    }
};

// Fetch contests from CodeChef (Scraping required)
const fetchCodeChefContests = async () => {
    try {
        const response = await axios.get("https://www.codechef.com/api/list/contests/all");
        console.log("CodeChef response received ", response.data);
        
        const contests = response.data.future_contests.map(contest => ({
            ...contest,
            link: `https://www.codechef.com/${contest.contest_code}`,
        }));

        return contests;
    } catch (error) {
        console.error("Error fetching CodeChef contests:", error);
        return [];
    }
};

// Fetch contests from AtCoder (Scraping required)
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

// API endpoint to fetch all contests
app.get("/contests", async (req, res) => {
    const codeforces = await fetchCodeforcesContests();
    const codechef = await fetchCodeChefContests();
    const atcoder = await fetchAtCoderContests();
    
    res.json([...codeforces, ...codechef, ...atcoder]);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));