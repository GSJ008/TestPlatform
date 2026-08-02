// Keeps server/data/users.xlsx in sync with the User collection.
//
// This isn't a second database - Mongo is still the source of truth for
// login/auth. This just gives you a human-readable spreadsheet snapshot of
// registered users (name, email, how they signed up, verification status)
// that you can open directly, without needing a Mongo GUI.
//
// Called after any event that changes user data: new registration, new
// Google sign-in, and email verification. Each call rewrites the whole
// sheet from the current DB state, so it can never drift out of sync -
// there's no partial-row-update logic to get wrong.
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const FILE_PATH = path.join(DATA_DIR, "users.xlsx");

async function syncUsersToExcel(User) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const users = await User.find({}).sort({ createdAt: 1 }).lean();

    const rows = users.map((u) => ({
      Name: u.name || "",
      Email: u.email || "",
      "Signed up with": u.authProvider === "google" ? "Google" : "Email/Password",
      Verified: u.isVerified ? "Yes" : "No",
      "Registered At": u.createdAt ? new Date(u.createdAt).toLocaleString() : ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Reasonable fixed column widths so the sheet is readable without
    // manual resizing every time it's regenerated.
    worksheet["!cols"] = [
      { wch: 24 }, // Name
      { wch: 30 }, // Email
      { wch: 16 }, // Signed up with
      { wch: 10 }, // Verified
      { wch: 22 }  // Registered At
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, FILE_PATH);
  } catch (err) {
    // Never let a spreadsheet write failure break registration/login -
    // this is a convenience export, not part of the auth path.
    console.error("Failed to sync users.xlsx:", err.message);
  }
}

module.exports = { syncUsersToExcel, FILE_PATH };