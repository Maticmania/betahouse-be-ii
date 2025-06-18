import axios from "axios";

export const getLocationFromIp = async (ip) => {
  try {
    if (ip === "::1" || ip === "127.0.0.1") return null; // skip local dev
    const { data } = await axios.get(
      `https://ipinfo.io/${ip}?token=${process.env.IPINFO_TOKEN}`
    );
    return {
      city: data.city,
      region: data.region,
      country: data.country,
      loc: data.loc,
    };
  } catch (err) {
    console.error("Failed to fetch IP location:", err.message);
    return null;
  }
};
