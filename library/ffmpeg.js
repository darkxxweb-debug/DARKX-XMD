"use strict";

/**
 * Small ffmpeg helper used by .toaudio and .tovideo (this file was missing,
 * which made both commands fail to load).
 *
 * convertBuffer(buffer, inExt, outExt, extraArgs) -> Promise<Buffer>
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

function ffmpegPath() {
    try {
        return require("ffmpeg-static") || "ffmpeg";
    } catch {
        return "ffmpeg"; // fall back to a system-wide ffmpeg
    }
}

async function convertBuffer(buffer, inExt, outExt, extraArgs = []) {
    let input = buffer;
    let ext = inExt;

    // ffmpeg cannot read ANIMATED webp, so turn it into a gif first (sharp can).
    if (inExt === "webp" && outExt !== "webp") {
        const sharp = require("sharp");
        input = await sharp(buffer, { animated: true }).gif().toBuffer();
        ext = "gif";
    }

    const id = crypto.randomBytes(6).toString("hex");
    const inFile = path.join(os.tmpdir(), `darkx_${id}.${ext}`);
    const outFile = path.join(os.tmpdir(), `darkx_${id}.${outExt}`);
    await fs.promises.writeFile(inFile, input);

    // mp4 needs even width/height
    const args = ["-y", "-i", inFile, ...extraArgs];
    if (outExt === "mp4" && !extraArgs.includes("-vf")) {
        args.push("-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2");
    }
    args.push(outFile);

    try {
        await new Promise((resolve, reject) => {
            const proc = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
            let err = "";
            proc.stderr.on("data", (d) => { err += d.toString(); if (err.length > 4000) err = err.slice(-4000); });
            proc.on("error", reject);
            proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(err || `ffmpeg exited with code ${code}`))));
        });
        return await fs.promises.readFile(outFile);
    } finally {
        fs.promises.unlink(inFile).catch(() => {});
        fs.promises.unlink(outFile).catch(() => {});
    }
}

module.exports = { convertBuffer };
