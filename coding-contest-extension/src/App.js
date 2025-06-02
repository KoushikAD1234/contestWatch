import React, { useMemo } from "react";
import useSWR from "swr";
import axios from "axios";

const fetcher = (url) => axios.get(url).then((res) => res.data);

function App() {
  const {
    data: contests = [],
    error,
    isLoading,
  } = useSWR(
    "https://contestwatch.onrender.com/contests",
    // "http://localhost:3000/contests",
    fetcher,
    { refreshInterval: 1000 * 60 * 5 } // refetch every 5 minutes
  );

  const parseDateIST = (dateInput) => {
    if (!dateInput || typeof dateInput !== "string") return new Date();

    try {
      const cleaned = dateInput.replace(/,+/, ",").replace(/\s+/g, " ").trim();

      if (
        cleaned.match(/(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/)
      ) {
        const [, day, month, year, hours, minutes, seconds] = cleaned.match(
          /(\d{2})\/(\d{2})\/(\d{4}),\s*(\d{2}):(\d{2}):(\d{2})/
        );
        return new Date(
          `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`
        );
      }

      if (
        cleaned.match(/(\d{2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
      ) {
        const [, day, monthStr, year, hour, minute, second] = cleaned.match(
          /(\d{2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/
        );
        const months = {
          Jan: "01",
          Feb: "02",
          Mar: "03",
          Apr: "04",
          May: "05",
          Jun: "06",
          Jul: "07",
          Aug: "08",
          Sep: "09",
          Oct: "10",
          Nov: "11",
          Dec: "12",
        };
        const month = months[monthStr];
        return new Date(
          `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`
        );
      }

      return new Date(dateInput);
    } catch (err) {
      console.error("Date parse error:", err);
      return new Date();
    }
  };

  const memoizedFormatDateTime = useMemo(() => {
    return (dateInput) => {
      const date =
        typeof dateInput === "number"
          ? new Date(dateInput * 1000)
          : parseDateIST(dateInput);

      return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });
    };
  }, []);

  const addToGoogleCalendar = (contest) => {
    const title = encodeURIComponent(
      contest.name || contest.contest_name || contest.id || contest.contest_code
    );

    const startDate = contest.startTimeSeconds
      ? new Date(contest.startTimeSeconds * 1000)
      : parseDateIST(contest.contest_start_date);

    let endDate;
    if (contest.durationSeconds) {
      endDate = new Date(startDate.getTime() + contest.durationSeconds * 1000);
    } else if (contest.contest_end_date) {
      endDate = parseDateIST(contest.contest_end_date);
    } else {
      endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    }

    const start = startDate.toISOString().replace(/-|:|\.\d+/g, "");
    const end = endDate.toISOString().replace(/-|:|\.\d+/g, "");

    const url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${start}/${end}`;
    window.open(url, "_blank");
  };

  if (isLoading)
    return <p className="text-white text-center">Loading contests...</p>;
  if (error)
    return <p className="text-red-400 text-center">Failed to load contests.</p>;

  return (
    <div className="bg-gray-950 text-white p-4 max-w-[400px] mx-auto min-h-[600px]">
      <h1 className="text-4xl md:text-5xl font-bold text-center text-amber-400 mb-5">
        Upcoming CP Contests
      </h1>
      <h1 className="text-3xl md:text-3xl font-bold text-center text-amber-400 mb-5">
        (Platforms: Codeforces, Codechef, AtCoder)
      </h1>
      <div className="flex items-center justify-center mb-10">
        <img
          src="/logo.png"
          alt="Logo"
          className="mr-2"
          style={{ width: "5rem", height: "6.5rem" }}
        />
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          ContestWatch
        </h1>
      </div>

      <ul className="space-y-6 max-w-3xl mx-auto">
        {contests.map((contest, index) => (
          <li
            key={index}
            className="bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-800"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex flex-col w-2/3">
                <a
                  href={contest.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-semibold text-blue-400 hover:text-blue-300"
                >
                  {contest.name ||
                    contest.contest_name ||
                    contest.id ||
                    contest.contest_code}
                </a>
                <div className="text-sm text-gray-300 mt-2 font-extrabold">
                  📅{" "}
                  {memoizedFormatDateTime(
                    contest.startTimeSeconds ||
                      contest.contest_start_date ||
                      contest.contest_start_date_iso
                  )}
                </div>
              </div>

              <button
                onClick={() => addToGoogleCalendar(contest)}
                className="ml-auto bg-amber-500 hover:bg-amber-600 text-black font-semibold px-4 py-2 rounded-lg transition"
              >
                Add to Google Calendar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
