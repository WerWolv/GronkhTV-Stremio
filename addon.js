const { addonBuilder, serveHTTP } = require("stremio-addon-sdk")
const fetch = require("node-fetch")

// Manifest definition
const manifest = {
    id: "net.werwolv.gronkhtv",
    version: "1.0.0",
    name: "GronkhTV",
    description: "Watch GronkhTV episodes directly in Stremio",
    types: ["series"],
    catalogs: [
        {
            type: "series",
            id: "gronkh_catalog",
            name: "GronkhTV",
            extra: [
                { name: "search", isRequired: false },
                { name: "skip", isRequired: false }
            ]
        }
    ],
    resources: ['catalog', 'meta', 'stream'],
    idPrefixes: ['grnk:'],
}

// Build addon
const builder = addonBuilder(manifest)

// Catalog handler – fetches latest episodes
builder.defineCatalogHandler(async ({ type, id, extra }) => {
    if (type !== "series" || id !== "gronkh_catalog") {
        return { metas: [] }
    }

    const search = extra.search || ""
    const skip = parseInt(extra.skip || "0", 10)

    let url = `https://api.gronkh.tv/v1/search?first=24&offset=${skip}&direction=desc&sort=date`

    if (search !== "") {
        url += `&query=${search}`
    }

    try {
        const res = await fetch(url)
        const data = await res.json()

        const videos = (data.results?.videos || [])

        const metas = videos.map(v => ({
            id: `grnk:${v.episode}`,
            type: "series",
            name: `[${v.episode}] ${v.title.split(" - ")[1]}`,
            poster: v.preview_url,
            posterShape: "landscape",
            description: `Views: ${v.views} · Length: ${Math.floor(v.video_length / 60)} min`,
            releaseInfo: new Date(v.created_at).toLocaleDateString("de-DE"),
        }))

        return { metas }
    } catch (err) {
        console.error("Catalog error:", err)
        return { metas: [] }
    }
})

builder.defineMetaHandler(async ({ type, id, extra }) => {
    let url = `https://api.gronkh.tv/v1/video/info?episode=${id.split(':')[1]}`
    try {
        const res = await fetch(url)
        const data = await res.json()

        let description = "Spiele: ";
        for (let chapter of data.chapters) {
            if (chapter.title === "Just Chatting")
                continue;
            description += `${chapter.title}, `
        }

        description = description.substring(0, description.length - 2)

        return {
            meta: {
                id: id,
                type: "series",
                name: `[${data.episode}] ${data.title.split(" - ")[1]}`,
                poster: data.preview_url,
                posterShape: "landscape",
                background: data.preview_url,
                description: description,
                releaseInfo: new Date(data.created_at).toLocaleDateString("de-DE"),
            }
        }
    } catch (err) {
        console.error("Catalog error:", err)
        return { metas: [] }
    }
})

// Stream handler – fetches playlist for selected episode
builder.defineStreamHandler(async ({type, id}) => {
    const parts = id.split(":")
    const episode = parts[parts.length - 1]
    if (!episode) return { streams: [] }

    const url = `https://api.gronkh.tv/v1/video/playlist?episode=${encodeURIComponent(episode)}`

    try {
        const resp = await fetch(url)
        const json = await resp.json()

        if (json.playlist_url) {
            return {
                streams: [
                    {
                        title: `GronkhTV - episode ${episode}`,
                        name: episode,
                        url: json.playlist_url
                    }
                ]
            }
        } else {
            console.log("[stream] no playlist_url in response:", json)
            return { streams: [] }
        }
    } catch (err) {
        console.error("[stream] fetch error:", err)
        return { streams: [] }
    }
})

module.exports = builder.getInterface()