# Image Converter

[![GitHub stars](https://img.shields.io/github/stars/NUCL3ARN30N/image-converter?style=for-the-badge)](https://github.com/NUCL3ARN30N/image-converter/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/NUCL3ARN30N/image-converter?style=for-the-badge)](https://github.com/NUCL3ARN30N/image-converter/network/members)
[![GitHub issues](https://img.shields.io/github/issues/NUCL3ARN30N/image-converter?style=for-the-badge)](https://github.com/NUCL3ARN30N/image-converter/issues)
[![GitHub license](https://img.shields.io/github/license/NUCL3ARN30N/image-converter?style=for-the-badge)](LICENSE)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=githubpages&logoColor=white)

> Client-side batch image converter with drag & drop, ZIP support & EXIF control

## Quick Start

**Live at:** [convert.genius-space.org](https://convert.genius-space.org)

## Supported Formats

| #  | Format          | Input | Output | Notes                                                 |
| -- | --------------- | :---: | :----: | ----------------------------------------------------- |
| 1  | JPEG / JPG      |  ✅   |   ✅   | Adjustable quality                                    |
| 2  | PNG             |  ✅   |   ✅   | Lossless with transparency                            |
| 3  | WebP            |  ✅   |   ✅   | Modern, efficient compression                         |
| 4  | GIF             |  ✅   |   ✅   | Static frames                                         |
| 5  | TIFF            |  ✅   |   —    | Decoded via UTIF.js                                   |
| 6  | HEIC / HEIF     |  ✅   |   —    | Apple format, decoded via heic2any                    |
| 7  | DNG             |  ✅   |   —    | Adobe RAW, TIFF-based decode + JPEG preview fallback  |
| 8  | CR2 / NEF / ARW |  ✅   |   —    | Canon / Nikon / Sony RAW via embedded JPEG extraction |
| 9  | BMP / SVG       |  ✅   |   —    | Native browser decode                                 |

## Features

| #  | Feature          | Description                                                         |
| -- | ---------------- | ------------------------------------------------------------------- |
| 1  | Drag & Drop      | Drop images, entire folders, or ZIP archives onto the drop zone     |
| 2  | ZIP Extraction   | Automatically extracts and processes all images inside ZIP files    |
| 3  | Folder Upload    | Select an entire folder via the system picker — preserves structure |
| 4  | Batch Conversion | Convert hundreds of files at once with real-time progress           |
| 5  | Quality Control  | Adjustable quality slider for JPEG and WebP output (10–100%)        |
| 6  | Resize           | Optional max dimension cap: 4K, Full HD, HD, Web, Thumbnail         |
| 7  | EXIF Removal     | Toggle to strip or preserve EXIF metadata (GPS, camera info, etc.)  |
| 8  | ZIP Download     | Download all converted files as a single ZIP archive                |
| 9  | Folder Structure | Option to maintain original folder hierarchy in output ZIP          |
| 10 | Live Stats       | Shows original vs. converted file sizes after batch processing      |

## Controls

| Control                          | Description                                                           |
| -------------------------------- | --------------------------------------------------------------------- |
| **Drag & Drop**                  | Drop files, folders, or `.zip` archives directly onto the upload area |
| **Browse Files / Select Folder** | Traditional file picker buttons for multi-select or folder input      |
| **Output Format**                | Choose between PNG, JPG, WebP, or GIF                                 |
| **Quality Slider**               | Adjust compression quality for lossy formats                          |
| **Max Dimension**                | Optionally resize the longest edge to a preset size                   |
| **Preserve Filename**            | Keep original filenames (with new extension)                          |
| **Maintain Folder Structure**    | Preserve directory paths in the downloaded ZIP                        |
| **Remove EXIF Data**             | Strip all metadata from output files (default: off)                   |
| **Download All as ZIP**          | Bundle all converted files into a single download                     |

## Requirements

**Browser:** Any modern browser (Chrome, Firefox, Safari, Edge)  
**Server:** None — fully static, runs 100% client-side  
**Dependencies:** Loaded via CDN (JSZip, heic2any, UTIF.js, Font Awesome, Google Fonts)

---

Badges from [envoy1084/awesome-badges](https://github.com/envoy1084/awesome-badges)
