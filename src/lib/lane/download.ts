/** Portable Windows build. Bump FILE_ID when a new zip is uploaded to Drive. */
export const WINDOWS_BUILD = "0.2.1";
export const WINDOWS_FILE_ID = "1ggyKPwn0notrnwO671M1IIZ-UCzo0wFr";

/** Direct file download (may still hit a Drive confirm page for large zips). */
export const WINDOWS_DOWNLOAD_URL = `https://drive.google.com/uc?export=download&id=${WINDOWS_FILE_ID}`;

/** Drive preview — use if the direct link is blocked. */
export const WINDOWS_DOWNLOAD_VIEW_URL = `https://drive.google.com/file/d/${WINDOWS_FILE_ID}/view`;

export const WINDOWS_FOLDER_URL =
  "https://drive.google.com/drive/folders/1Mt51vCQELFEY7Ny2lhuotqcfpE76YEr_";
