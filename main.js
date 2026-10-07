import "dotenv/config"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import nodeHtmlToImage from "node-html-to-image"
import { Client, GatewayIntentBits, SlashCommandBuilder, MessageFlags, ActivityType, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js"

// MLV3 is not endorsed by Riot Games and does not reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties.
// Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SETTINGS_PATH = path.join(__dirname, "settings.json")

const client = new Client({intents: [GatewayIntentBits.Guilds]})

let matchQueue = []
let knownLiveGames = []
let isProcessing = false
let isUpdatingMatch = false
let isUpdatingSpectator = false
let liveGamesLP = {}

let gameJSON = {gameDuration: 1, gameDurationFormated: "00:00", gameDate: "00/00/00", sides: [{ totalKills: 0, win: false, objectives: {}, players: [] }, { totalKills: 0, win: false, objectives: {}, players: [] }]}

var header = new Headers()
header.append("X-Riot-Token", process.env.RIOT_TOKEN)
var fetchOptions = { method: "GET", headers: header, redirect: "manual",}

const css = await fs.readFile("./src/output.css", "utf8")
const loss = `<h2 class="text-red-500 ml-3 font-semibold text-2xl">Defeat</h2>`
const win = `<h2 class="text-blue-600 ml-3 font-semibold text-2xl">Victory</h2>`
const svg = {
    grubs: await fs.readFile("./svg/grubs.svg", "utf8"),
    dragon: await fs.readFile("./svg/dragon.svg", "utf8"),
    herald: await fs.readFile("./svg/herald.svg", "utf8"),
    nashor: await fs.readFile("./svg/nashor.svg", "utf8"),
    tower: await fs.readFile("./svg/tower.svg", "utf8"),
    UNRANKED: await fs.readFile("./svg/unranked.svg", "utf8"),
    IRON: await fs.readFile("./svg/iron.svg", "utf8"),
    BRONZE: await fs.readFile("./svg/bronze.svg", "utf8"),
    SILVER: await fs.readFile("./svg/silver.svg", "utf8"),
    GOLD: await fs.readFile("./svg/gold.svg", "utf8"),
    PLATINUM: await fs.readFile("./svg/platinum.svg", "utf8"),
    EMERALD: await fs.readFile("./svg/emerald.svg", "utf8"),
    DIAMOND: await fs.readFile("./svg/diamond.svg", "utf8"),
    MASTER: await fs.readFile("./svg/master.svg", "utf8"),
    GRANDMASTER: await fs.readFile("./svg/grandmaster.svg", "utf8"),
    CHALLENGER: await fs.readFile("./svg/challenger.svg", "utf8")
}
const whitelistQueue = {
    490: "Swiftplay",
    480: "Swiftplay",
    440: "Ranked Flex",
    430: "Blind Pick",
    420: "Ranked Solo/Duo",
    400: "Draft",
}
const TIERS_VALUE = { "IRON": 0, "BRONZE": 1, "SILVER": 2, "GOLD": 3, "PLATINUM": 4, "EMERALD": 5, "DIAMOND": 6, "MASTER": 7, "GRANDMASTER": 7, "CHALLENGER": 7 }
const DIVISIONS_VALUE = { "IV": 0, "III": 1, "II": 2, "I": 3 }

async function getSettings() {
    try {
        const data = await fs.readFile(SETTINGS_PATH, "utf8")
        return JSON.parse(data)
    } catch (error) {
        console.error("[MLV3 - ${new Date().toLocaleTimeString()}] Error, can not read settings.json.", error)
        return SETTINGS || {}
    }
}
async function setSettings(settings) { try { await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8") } catch (error) { return {}}}
export let SETTINGS = await getSettings()
var players_data = SETTINGS.joueurs
var ddragon = SETTINGS.data_dragon

const summoner = {
    1: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerBoost.png`,
    3: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerExhaust.png`,
    4: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerFlash.png`,
    6: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerHaste.png`,
    7: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerHeal.png`,
    11: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerSmite.png`,
    12: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerTeleport.png`,
    13: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerMana.png`,
    14: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerDot.png`,
    21: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerBarrier.png`,
    30: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerPoroRecall.png`,
    31: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerPoroThrow.png`,
    32: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerSnowball.png`,
    39: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerSnowURFSnowball_Mark.png`,
    54: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerTeleport.png`,
    2202: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerCherryFlash.png`,
    2201: `https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/spell/SummonerCherryHold.png`
}
const championJSON = await getJSON(`https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/champion.json`)
const runesJSON = await getJSON(`http://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/runesReforged.json`)
const tierlistData = JSON.parse(await fs.readFile("./tierlist.json", "utf-8"))

async function getJSON(
    url = `https://ddragon.leagueoflegends.com/cdn/${ddragon}/data/en_US/champion.json`
) {
    while (true) {
        try {
            const response = await fetch(url,{
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US;q=0.8,en;q=0.7'
                }
            })
            if (!response.ok) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error ${response.status} (${response.statusText}) on getJSON. Retry in 30s. (URL: ${url})`)
                await new Promise(resolve => setTimeout(resolve, 30000))
                continue
            }
            return await response.json()
        } catch (err) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getJSON. Retry in 30s.`, err)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get player rank, it focuses on SOLO DUO rank but switches to FLEX if player is unranked in SOLO DUO.
async function getRank(puuid, region) {
    if(!puuid || !region) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error puuid or region is empty on getRank. Check settings.json for empty strings. This should not happen.`)
        return 1
    }
    while (true) {
        try {
            const response = await fetch(`https://${region.toLowerCase()}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`, fetchOptions)
            if (response.ok) {
                const result = await response.json()
                const solo = result.find(item => item.queueType === "RANKED_SOLO_5x5")
                const flex = result.find(item => item.queueType === "RANKED_FLEX_SR")

                const sTier = solo?.tier || "UNRANKED"
                const sRank = solo?.rank || ""
                const sLp = solo?.leaguePoints || 0
                const sWL = solo ? `${solo.wins}/${solo.losses}` : "0/0"

                const fTier = flex?.tier || "UNRANKED"
                const fRank = flex?.rank || ""
                const fLp = flex?.leaguePoints || 0

                return [sTier, sRank, sLp, sWL, fTier, fRank, fLp]
            }
            if (response.status === 429) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] getRank is rate limited. Retry in 2 min.`)
                await new Promise(resolve => setTimeout(resolve, 120000))
                continue
            }
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error ${response.status} (${response.statusText}) on getRank.`)
            return ["UNRANKED", "", 0, "0/0", "UNRANKED", "", 0]
        } catch (error) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getRank. Retry in 30s.`, error)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get summoner level also known as account level.
async function getSummonerLevel(puuid, region) {
    if(!puuid || !region) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error puuid or region is empty on getSummonerLevel. Check settings.json for empty strings. This should not happen.`)
        return 1
    }
    while (true) {
        try {
            const response = await fetch(`https://${region.toLowerCase()}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`, fetchOptions)
            if (response.ok) {
                const result = await response.json()
                return result.summonerLevel || 0
            }
            if (response.status == 429) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] getSummonerLevel is rate limited. Retry in 2 min.`)
                await new Promise(resolve => setTimeout(resolve, 120000))
                continue
            }
            return 0
        } catch (error) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getSummonerLevel. Retry in 30s.`, error)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get 5 latest match IDs done by a player. This can recover previous missed matches.
async function getMatchIDs(puuid, server) {
    if(!puuid || !server) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error puuid or server is empty on getMatchIDs. This should not happen.`)
        return 1
    }
    while (true) {
        try {
            const response = await fetch(`https://${server}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=5`, fetchOptions)
            if (response.ok) {
                const result = await response.json()
                return result || []
            }
            if (response.status === 429) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] getMatchIDs is rate limited. Retry in 2 min.`)
                await new Promise(resolve => setTimeout(resolve, 120000))
                continue
            }
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error ${response.status} (${response.statusText}) on getMatchIDs.`)
            return []
        } catch (error) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getMatchIDs. Retry in 30s.`, error)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get all the data related to a current match. The spectator data is not as right as normal match data. (Like champion lane / role or ban order)
async function getSpectatorData(puuid, region) {
    if(!puuid || !region) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error puuid or region is empty on getSpectatorData. Check settings.json for empty strings. This should not happen.`)
        return 1
    }
    while (true) {
        try {
            const response = await fetch(`https://${region.toLowerCase()}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${puuid}`, fetchOptions)
            if (response.ok) return await response.json()
            if (response.status != 404) console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error ${response.status} (${response.statusText}) on getSpectatorData.`)
            if (response.status == 429) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] getSpectatorData is rate limited. Retry in 2 min.`)
                await new Promise(resolve => setTimeout(resolve, 120000))
                continue
            }
            return null
        } catch (error) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getSpectatorData. Retry in 30s.`, error)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get all the data related to a finished match.
async function getMatchData(matchID, server) {
    if(!matchID || !server) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error matchID or server is empty on getMatchData. This should not happen.`)
        return 1
    }
    while (true) {
        try {
            const response = await fetch(`https://${server}.api.riotgames.com/lol/match/v5/matches/${matchID}`, fetchOptions)
            if (response.ok) return await response.json()
            if (response.status === 429) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] getMatchData is rate limited. Retry in 2 min.`)
                await new Promise(resolve => setTimeout(resolve, 120000))
                continue
            }
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error ${response.status} (${response.statusText}) on match ${matchID}.`)
            return null
        } catch (error) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Network error on getMatchData. Retry in 30s.`, error)
            await new Promise(resolve => setTimeout(resolve, 30000))
            continue
        }
    }
}

// Get a nicer format for display purposes.
function getGameDurationFormat(seconds) {
    const hh = Math.floor(seconds / 3600)
    const mm = Math.floor((seconds % 3600) / 60)
    const ss = Math.floor(seconds % 60)
    const pad = (num) => String(num).padStart(2, "0")
    if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`
    return `${pad(mm)}:${pad(ss)}`
}

// Some champions have a different name in file vs in game. So we need to check for them, like WUKONG can be named MONKEY KING in the files.
function getChampionName(ID) {
    const champions = Object.values(championJSON.data)
    const found = champions.find(champ => champ.key == String(ID))
    return found ? found.id : null
}

// Get images related to used runes by each player. Default to an empty box if none is found.
function getRunesImages(mrStyleID, mrPerkID, srStyleID) {
    const emptyBox = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    const runes = Object.values(runesJSON || {})
    const mrFind = runes.find(rune => rune.id == mrStyleID)
    let mainRuneUrl = emptyBox
    if (mrFind && mrFind.slots && Array.isArray(mrFind.slots[0]?.runes)) {
        const perk = mrFind.slots[0].runes.find(rune => rune.id == mrPerkID)
        if (perk?.icon) mainRuneUrl = `https://ddragon.leagueoflegends.com/cdn/img/${perk.icon}`
    }
    const srFind = runes.find(rune => rune.id == srStyleID)
    let subRuneUrl = emptyBox
    if (srFind?.icon) subRuneUrl = `https://ddragon.leagueoflegends.com/cdn/img/${srFind.icon}`
    return [mainRuneUrl, subRuneUrl]
}

// Change the displayed color depending on the player KDA (Kill + Assist / Death).
function getKdaColor(kda) {
    const val = Number(kda)
    if (val >= 5.0) return "#ffe8a3"
    if (val >= 2.6) return "#DECCFB"
    if (val >= 1.6) return "#a1e4f9"
    return "#9b9c9e"
}

// Display a Discord activity under the bot. It shows every win/loss and the winrate it oversees from the start.
function updateActivity() {
    if (!client.user) return

    const wins = SETTINGS.win || 0
    const losses = SETTINGS.loss || 0
    const winrate = (wins + losses) > 0 ? Math.round((wins / (wins+losses)) * 100) : 0

    client.user.setActivity({
        name: `${wins} Win | ${losses} Loss (WR ${winrate}%)`,
        type: ActivityType.Listening
    })
}

// Get player LP gain or loss (even with a rank up or down).
function getAbsoluteLP(tier, division, lp) {
    if (tier === "UNRANKED") return 0
    if (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(tier)) return (TIERS_VALUE[tier] * 400) + Number(lp)
    return (TIERS_VALUE[tier] * 400) + (DIVISIONS_VALUE[division] * 100) + Number(lp)
}

// Calculate the difference between the Spectator ping and game result. To work, it needs to send a "spectator" image on Discord to make the difference before and after the game.
function calculateLPDiff(gameId, puuid, currentTier, currentDivision, currentLp) {
    if (!liveGamesLP[gameId] || !liveGamesLP[gameId][puuid]) return ""

    const old = liveGamesLP[gameId][puuid]
    if (old.tier === "UNRANKED" || currentTier === "UNRANKED") return ""

    const oldAbsolute = getAbsoluteLP(old.tier, old.division, old.lp)
    const newAbsolute = getAbsoluteLP(currentTier, currentDivision, currentLp)
    const diff = newAbsolute - oldAbsolute

    if (diff > 0) return `+${diff}LP`
    if (diff < 0) return `${diff}LP`
    return `0LP`
}

// Add a player to settings.json and it will be looked after by the bot.
export async function addUser(summonerName, summonerID, region) {
    if (!summonerName || !summonerID || !region) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error summonerName, summonerID or region is empty on addUser. This should not happen.`)
        return 1
    }

    if (players_data.some(p => p.user === summonerName)) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Player ${summonerName}#${summonerID} is already added.`)
        return false
    }

    // Get Main Region
    let server = "europe"
    if (["EUN1", "EUW1", "RU", "TR1"].includes(region)) server = "europe"
    if (["BR1", "LA1", "LA2", "NA1"].includes(region)) server = "americas"
    if (["JP1", "KR"].includes(region)) server = "asia"
    if (["SG2", "OC1", "TW2", "VN2"].includes(region)) server = "sea"

    const responsePUUID = await fetch(
        `https://${server}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${summonerName}/${summonerID}`,
        fetchOptions
    )
    if (!responsePUUID.ok) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error while getting player's PUUID.`)
        return false
    }
    const result = await responsePUUID.json()
    let puuid = result.puuid || null

    if (!puuid) {
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error while getting player's PUUID.`)
        return false
    }

    let recentMatches = await getMatchIDs(puuid, server)
    let matchID = recentMatches.length > 0 ? recentMatches[0] : null
    let user = {
        user: summonerName,
        id: summonerID,
        puuid: puuid,
        region: region,
        server: server,
        matchID: matchID
    }

    // Update settings vars.
    players_data.push(user)
    SETTINGS.joueurs = players_data
    await setSettings(SETTINGS)

    console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Player ${summonerName}#${summonerID} has been added.`)
    return true
}

// Update the list of matches to send on Discord.
export async function updateMatch() {
    if (isUpdatingMatch) return
    isUpdatingMatch = true

    try {
        SETTINGS = await getSettings()
        players_data = SETTINGS.joueurs

        if (players_data.length == 0 ) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Player's list is empty. Add a player with /adduser on Discord.`)
            return 0
        }

        for (let i = 0; i < players_data.length; i++) {
            let player = players_data[i]
            let matchIDOld = player.matchID

            let recentMatches = await getMatchIDs(player.puuid, player.server)
            if (recentMatches.length === 0) continue

            let newMatchesToProcess = []

            let oldMatchIndex = recentMatches.indexOf(matchIDOld)
            if (oldMatchIndex !== -1) newMatchesToProcess = recentMatches.slice(0, oldMatchIndex)
            else newMatchesToProcess = recentMatches

            newMatchesToProcess.reverse().forEach(newMatchID => {
                let existingGame = matchQueue.find(game => game.id === newMatchID)
                if (existingGame) { if (!existingGame.users.includes(player.user)) existingGame.users.push(player.user) }
                else {
                    console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] New match found for ${player.user}#${player.id} ${newMatchID} (${SETTINGS.win} / ${SETTINGS.loss})`)
                    matchQueue.push({ id: newMatchID, server: player.server, isLive: false, users: [player.user] })
                }
            })
        }

        SETTINGS.joueurs = players_data
        await setSettings(SETTINGS)

        processQueue()
        if (!isProcessing) console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] No new match found. (updateMatch)`)
    } finally {
        isUpdatingMatch = false
    }
}

// Update the list of on going matches to send on Discord.
export async function updateSpectator() {
    if (isUpdatingSpectator) return
    isUpdatingSpectator = true

    try {
        SETTINGS = await getSettings()
        players_data = SETTINGS.joueurs

        if (players_data.length == 0 ) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Player's list is empty. Add a player with /adduser on Discord.`)
            return 0
        }

        for (let i = 0; i < players_data.length; i++) {
            let player = players_data[i]
            let liveData = await getSpectatorData(player.puuid, player.region)

            if (liveData && liveData.gameId) {
                if (whitelistQueue[liveData.gameQueueConfigId]) {
                    let liveGameId = liveData.gameId
                    let existingGame = matchQueue.find(game => game.id === liveGameId)
                    if (existingGame) {
                        if (!existingGame.users.includes(player.user)) existingGame.users.push(player.user)
                    } else if (!knownLiveGames.includes(liveGameId)) {
                        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] New current match found for ${player.user}#${player.id}`)
                        knownLiveGames.push(liveGameId)
                        if (knownLiveGames.length > 10) knownLiveGames.shift()
                        matchQueue.push({ id: liveGameId, isLive: true, spectatorData: liveData, users: [player.user] })
                    }
                }
            }
        }
        processQueue()
        if (!isProcessing) console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] No new current match found. (updateSpectator)`)
    } finally {
        isUpdatingSpectator = false
    }
}

// Logic to process each game data and generate the HTML code.
async function processQueue() {
    if (isProcessing) return
    isProcessing = true

    try {
        while (matchQueue.length > 0) {
            const match = matchQueue[0]
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Starting generating a new match image (${match.isLive ? 'On Going' : 'Finished'}).`)

            try {
                let html, matchData

                if (match.isLive) {
                    html = await generateSpectatorHTML(match.spectatorData)
                } else {
                    matchData = await getMatchData(match.id, match.server)

                    if (!matchData) {
                        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Can not get the match (${match.id}), skipping...`)
                        continue
                    }

                    if (!whitelistQueue[matchData.info.queueId]) continue

                    const isRemake = matchData.info.gameDuration < 240
                    match.results = []

                    if (!isRemake) {
                        for (let username of match.users) {
                            let participant = matchData.info.participants.find(p => p.riotIdGameName === username)
                            if (participant) match.results.push({ username, isWin: participant.win })
                        }

                        if (match.results.length > 0) {
                            match.isWin = match.results[0].isWin
                            if (match.isWin) SETTINGS.win = (SETTINGS.win || 0) + 1
                            else SETTINGS.loss = (SETTINGS.loss || 0) + 1
                        }

                        await setSettings(SETTINGS)
                        SETTINGS = await getSettings()
                    }

                    html = await generateHTML(matchData)
                }

                await nodeHtmlToImage({ output: './image.png', html: html })
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Finished generating a new match image. (${match.id}) (${SETTINGS.win} / ${SETTINGS.loss})`)

                await sendMessage(match)

                if (!match.isLive) {
                    for (let player of SETTINGS.joueurs) {
                        if (match.users.includes(player.user)) {
                            player.matchID = match.id
                        }
                    }
                    await setSettings(SETTINGS)
                }
            } catch (error) {
                console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error while generating a match image.`, error)
                continue
            } finally {
                matchQueue.shift()
                await new Promise(resolve => setTimeout(resolve, 30000))
            }
        }
    } finally {
        isProcessing = false
    }
}

// Generating the HTML code for a finished match.
async function generateHTML(data) {
    let champData = data.info.participants

    if (data.info.gameDuration > 0) gameJSON.gameDuration = Number(data.info.gameDuration) || 0
    else if (data.info.gameEndTimestamp > 0 && data.info.gameStartTimestamp > 0) gameJSON.gameDuration = Math.floor((Number(data.info.gameEndTimestamp) - Number(data.info.gameStartTimestamp)) / 1000) || 0
    gameJSON.gameDurationFormated = getGameDurationFormat(gameJSON.gameDuration) || "00:00"
    gameJSON.gameDate = new Date(data.info.gameCreation).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })

    for (let i = 0; i < 2; i++) {
        gameJSON.sides[i].objectives = {
            grubs: data.info.teams[i].objectives.horde.kills,
            dragon: data.info.teams[i].objectives.dragon.kills,
            baron: data.info.teams[i].objectives.baron.kills,
            herald: data.info.teams[i].objectives.riftHerald.kills,
            tower: data.info.teams[i].objectives.tower.kills
        }
    }

    gameJSON.sides[0].win = Boolean(data.info.teams[0].win)
    gameJSON.sides[1].win = Boolean(data.info.teams[1].win)

    gameJSON.sides[0].totalKills = data.info.teams[0].objectives.champion.kills || 0
    gameJSON.sides[1].totalKills = data.info.teams[1].objectives.champion.kills || 0

    const getPlayerData = async (playerData, teamIndex, playerIndex) => {
        let player = {}
        player.name = playerData.riotIdGameName
        player.tag = playerData.riotIdTagline
        player.position = playerData.teamPosition
        player.champion = playerData.championName === "FiddleSticks" ? "Fiddlesticks" : playerData.championName // Thanks Riot.
        player.level = playerData.champLevel
        player.ban = getChampionName(data.info.teams[teamIndex].bans[playerIndex]?.championId)
        player.banHTML = player.ban ? `<img class="rounded" width="38" height="38" src="https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/champion/${player.ban}.png"></img>` : "<div class='min-w-9.5 min-h-9.5 bg-[#0d0f10] rounded border border-white/10'></div>"
        player.summoner1 = summoner[playerData.summoner1Id] || summoner[4]
        player.summoner2 = summoner[playerData.summoner2Id] || summoner[12]
        player.kills = playerData.kills || 0
        player.deaths = playerData.deaths || 0
        player.assists = playerData.assists || 0
        player.kda = ((player.kills + player.assists) / (player.deaths || 1)).toFixed(1) || 0.0
        player.kdaColor = getKdaColor(player.kda)
        let totalKills = gameJSON.sides[teamIndex].totalKills
        player.kp = totalKills > 0 ? Math.ceil(((player.kills + player.assists) / totalKills) * 100) : 0
        player.csMin = Math.round(((playerData.neutralMinionsKilled + playerData.totalMinionsKilled) / (gameJSON.gameDuration / 60)) * 10) / 10 || 0.0
        player.visionMin = Math.round((playerData.visionScore / ((gameJSON.gameDuration || 1) / 60)) * 10) / 10 || 0.0
        player.damage = playerData.totalDamageDealtToChampions >= 1000 ? `${(playerData.totalDamageDealtToChampions / 1000).toFixed(1)} <span class="font-normal">K</span>` : playerData.totalDamageDealtToChampions
        player.damageMin = Math.floor(playerData.totalDamageDealtToChampions / (gameJSON.gameDuration / 60)) || 0.0
        player.items = [
            playerData.item0 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item0}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item1 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item1}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item2 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item2}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item3 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item3}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item4 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item4}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item5 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item5}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.item6 > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.item6}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`,
            playerData.roleBoundItem > 0 ? `<img class="rounded" width='22' height='22' src='https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/item/${playerData.roleBoundItem}.png'>` : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`
        ]

        player.ranks = await getRank(playerData.puuid, data.info.platformId)

        player.displayRank = player.ranks[0] === "UNRANKED"
            ? [player.ranks[4], player.ranks[5], player.ranks[6], ""]
            : [player.ranks[0], player.ranks[1], player.ranks[2], ` - ${player.ranks[3]}`]

        let diffValue = data.info.queueId === 440
            ? calculateLPDiff(data.info.gameId, playerData.puuid, player.ranks[4], player.ranks[5], player.ranks[6])
            : calculateLPDiff(data.info.gameId, playerData.puuid, player.ranks[0], player.ranks[1], player.ranks[2])

        player.lpDiff = ((data.info.queueId === 420 || data.info.queueId === 440) && diffValue !== "" && diffValue !== "0LP")
            ? `<span class="text-[10px] text-[#ffe8a3]">${diffValue}</span>`
            : ""
        player.runes = getRunesImages(playerData.perks.styles[0].style, playerData.perks.styles[0].selections[0].perk, playerData.perks.styles[1].style)

        gameJSON.sides[teamIndex].players[playerIndex] = player
    }

    const blueTeam = champData.filter(p => p.teamId === 100)
    for (let i = 0; i < blueTeam.length; i++) {
        await getPlayerData(blueTeam[i], 0, i)
        await new Promise(r => setTimeout(r, 50))
    }

    const redTeam = champData.filter(p => p.teamId === 200)
    for (let i = 0; i < redTeam.length; i++) {
        await getPlayerData(redTeam[i], 1, i)
        await new Promise(r => setTimeout(r, 50))
    }

    // Generating HTML code for each player.
    const generatePlayerHTML = async (teamIndex, playerIndex) => {
        let player = gameJSON.sides[teamIndex].players[playerIndex]
        return `
            <li class="flex ml-3 pt-3">
                <div>
                    <img class="absolute rounded" width="38" height="38" src="https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/champion/${player.champion || "Aatrox"}.png">
                    <p class="text-[#cdcecf] relative top-7 left-6 bg-[#131619] rounded border border-white/10 font-semibold max-w-5 min-w-5 text-[12px] flex items-center justify-center min-h-4 max-h-4">${player.level || 20}</p>
                </div>
                <div class="ml-10 w-50">
                    <div class="flex items-end">
                        <h2 class="text-white">${player.name || "Unknown"}</h2>
                        <p class="text-[#9b9c9e] text-[10px] pb-0.5 pl-1">#${player.tag || "Unknown"}</p>
                    </div>
                    <div class="flex gap-2 items-center">
                        <div class="shrink-0 flex items-center">
                            ${svg[player.displayRank[0]] || svg.UNRANKED}
                        </div>
                        <p class="text-[#9b9c9e] font-semibold whitespace-nowrap uppercase text-[12px]">
                            ${player.displayRank[0] !== "UNRANKED"
                                ? `${player.displayRank[0]} ${player.displayRank[1]} <span class="text-[10px]">(${player.displayRank[2]}LP${player.displayRank[3]}) ${player.lpDiff}`
                                : player.displayRank[0]
                            }
                        </p>
                    </div>
                </div>
                <div class="flex flex-col gap-2 ml-15">
                    <img class="rounded" width="22" height="22" src="${player.summoner1}">
                    <img class="rounded" width="22" height="22" src="${player.summoner2}">
                </div>
                <div class="flex flex-col gap-2 ml-3">
                    <img class="bg-[#0d0f10] border border-white/10 rounded" width="22" height="22" src="${player.runes[0]}">
                    <img class="bg-[#0d0f10] border border-white/10 rounded" width="22" height="22" src="${player.runes[1]}">
                </div>
                <div class="border border-zinc-800 h-4 mt-4 ml-4"></div>
                <div class="flex flex-col gap-2 ml-4">
                    <div class="flex gap-1">
                        ${player.items[0]}
                        ${player.items[1]}
                        ${player.items[2]}
                        ${player.items[6]}
                    </div>
                    <div class="flex gap-1">
                        ${player.items[3]}
                        ${player.items[4]}
                        ${player.items[5]}
                        ${player.items[7]}
                    </div>
                </div>
                <div class="flex ml-15 text-2xl items-center justify-center gap-2 w-20">
                    <p class="text-[#cdcecf] font-bold">${player.kills}</p>
                    <p class="text-[#9b9c9e] opacity-70 font-extralight text-[12px]">/</p>
                    <p class="text-[#fa837d] font-bold">${player.deaths}</p>
                    <p class="text-[#9b9c9e] opacity-70 font-extralight text-[12px]">/</p>
                    <p class="text-[#cdcecf] font-bold">${player.assists}</p>
                </div>
                <div class="flex flex-col items-center ml-10 w-10">
                    <p class="text-[${player.kdaColor}] font-bold">${player.kda}</p>
                    <p class="text-[#9b9c9e] opacity-70 text-sm">KDA</p>
                </div>
                <div class="flex flex-col items-center ml-10 w-10">
                    <p class="text-[#cdcecf] font-bold">${player.kp} <span class="font-normal">%</span></p>
                    <p class="text-[#9b9c9e] opacity-70 text-sm">KP</p>
                </div>
                <div class="flex flex-col items-center ml-5 w-20">
                    <p class="${player.position === "UTILITY" ? "text-purple-200" : "text-yellow-200"} font-bold">${player.position === "UTILITY" ? player.visionMin : player.csMin}</p>
                    <p class="text-[#9b9c9e] opacity-70 text-sm">${player.position === "UTILITY" ? "VISION" : "CS"}/min</p>
                </div>
                <div class="flex flex-col items-center ml-5 w-15">
                    <p class="text-[#cdcecf] font-bold">${player.damage}</p>
                    <p class="text-[#9b9c9e] opacity-70 text-sm">(${player.damageMin}/min)</p>
                </div>
                <div class="flex justify-center items-center ml-10">
                    ${player.banHTML}
                </div>
            </li>
        `
    }

    const blueTeamHTML = (await Promise.all([0, 1, 2, 3, 4].map(idx => generatePlayerHTML(0, idx)))).join('')
    const redTeamHTML = (await Promise.all([0, 1, 2, 3, 4].map(idx => generatePlayerHTML(1, idx)))).join('')

    delete liveGamesLP[data.info.gameId]

    // Generating game HTML code and adding each player to it.
    return `
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet">
                <style>${css}</style>
            </head>
            <body class="w-275 font-sans tabular-nums bg-[#0d0f10]">
                <div class="bg-[#131619] w-full h-full">
                    <div class="w-full h-full">
                        <div class="h-[50%]">
                            <header class="flex items-center gap-10 bg-[#0d0f10] p-3">
                                ${gameJSON.sides[0].win ? win : loss}
                                <p class="text-zinc-500">(Blue Side)</p>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[0].objectives.grubs || 0}</p>
                                    ${svg.grubs}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[0].objectives.dragon || 0}</p>
                                    ${svg.dragon}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[0].objectives.baron || 0}</p>
                                    ${svg.nashor}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[0].objectives.herald || 0}</p>
                                    ${svg.herald}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[0].objectives.tower || 0}</p>
                                    ${svg.tower}
                                </div>
                                <div class="flex flex-col items-center ml-25">
                                    <h2 class="text-[#9b9c9e] font-bold">${whitelistQueue[Number(data.info.queueId)] || "Normal Draft"}</h2>
                                    <p class="text-zinc-500">${gameJSON.gameDurationFormated} - ${gameJSON.gameDate}</p>
                                </div>
                            </header>
                            <ul class="pb-3">${blueTeamHTML}</ul>
                        </div>
                        <div class="h-[50%]">
                            <header class="flex items-center gap-10 bg-[#0d0f10] p-3">
                                ${gameJSON.sides[1].win ? win : loss}
                                <p class="text-zinc-500">(Red Side)</p>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[1].objectives.grubs || 0}</p>
                                    ${svg.grubs}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[1].objectives.dragon || 0}</p>
                                    ${svg.dragon}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[1].objectives.baron || 0}</p>
                                    ${svg.nashor}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[1].objectives.herald || 0}</p>
                                    ${svg.herald}
                                </div>
                                <div class="flex items-center">
                                    <p class="text-2xl text-[#9b9c9e] font-bold">${gameJSON.sides[1].objectives.tower || 0}</p>
                                    ${svg.tower}
                                </div>
                            </header>
                            <ul class="pb-3">${redTeamHTML}</ul>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    `
}

// Generating the HTML code for a on going match.
async function generateSpectatorHTML(data) {
    if (!liveGamesLP[data.gameId]) liveGamesLP[data.gameId] = {}
    const spectator = {
        duration: data.gameLength > 0 ? getGameDurationFormat(data.gameLength) : "00:00",
        date: new Date(data.gameStartTime).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: '2-digit' }),
        gamemode: whitelistQueue[data.gameQueueConfigId] || "Normal Draft"
    }

    const roleOrder = {
        "TOP": 1,
        "JUNGLE": 2,
        "MIDDLE": 3, "MID": 3,
        "BOTTOM": 4, "BOT": 4, "ADC": 4,
        "UTILITY": 5, "SUP": 5, "SUPPORT": 5, "SUPP": 5
    }

    const getRole = (p) => {
        if (p.spell1Id == 11 || p.spell2Id == 11) return "JUNGLE"
        const champ = tierlistData.champions?.find(c => c.championId === p.championId)
        if (!champ?.lanesPickrate) return "TOP"
        return Object.entries(champ.lanesPickrate).reduce((max, curr) => curr[1] > max[1] ? curr : max)[0]
    }

    const sortTeamByRoles = (teamParticipants) => {
        let available = [...teamParticipants]
        let ordered = new Array(5).fill(null)

        const extractBestForRole = (role, ignoreSmite = false) => {
            let bestIdx = 0
            let maxPickrate = -1

            for (let i = 0; i < available.length; i++) {
                if (ignoreSmite && (available[i].spell1Id == 11 || available[i].spell2Id == 11)) continue

                const champ = tierlistData.champions?.find(c => c.championId === available[i].championId)
                const pickrate = champ?.lanesPickrate?.[role] || 0

                if (pickrate > maxPickrate) {
                    maxPickrate = pickrate
                    bestIdx = i
                }
            }

            if (maxPickrate === -1 && ignoreSmite && available.length > 0) {
                return extractBestForRole(role, false)
            }

            return available.splice(bestIdx, 1)[0]
        }

        ordered[0] = extractBestForRole("TOP", true)

        let jglIdx = available.findIndex(p => p.spell1Id == 11 || p.spell2Id == 11)
        if (jglIdx !== -1) {
            ordered[1] = available.splice(jglIdx, 1)[0]
        } else {
            ordered[1] = extractBestForRole("JUNGLE")
        }

        ordered[2] = extractBestForRole("MIDDLE", true)
        ordered[3] = extractBestForRole("BOTTOM", true)
        ordered[4] = available.length > 0 ? available.shift() : null

        return ordered.filter(Boolean)
    }

    const getPlayerHtml = async (p, side, index) => {
        const [name, tag] = (p.riotId || "Unknown#Unknown").split("#")
        const champion = getChampionName(p.championId) || "Aatrox"

        const ranks = await getRank(p.puuid, data.platformId)

        const displayRank = ranks[0] === "UNRANKED"
            ? [ranks[4], ranks[5], ranks[6], ""]
            : [ranks[0], ranks[1], ranks[2], ` - ${ranks[3]}`]

        liveGamesLP[data.gameId][p.puuid] = data.gameQueueConfigId === 440
            ? { tier: ranks[4], division: ranks[5], lp: ranks[6] }
            : { tier: ranks[0], division: ranks[1], lp: ranks[2] }

        const level = await getSummonerLevel(p.puuid, data.platformId)

        const sum1 = summoner[p.spell1Id]
            ? `<img class="rounded" width="22" height="22" src="${summoner[p.spell1Id]}"></img>`
            : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`
        const sum2 = summoner[p.spell2Id]
            ? `<img class="rounded" width="22" height="22" src="${summoner[p.spell2Id]}"></img>`
            : `<div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>`

        let runesHTML = `
            <div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>
            <div class='min-w-5.5 min-h-5.5 bg-[#0d0f10] rounded border border-white/10'></div>
        `
        if (p.perks?.perkStyle && p.perks?.perkIds[0] && p.perks?.perkSubStyle) {
            const runes = getRunesImages(p.perks?.perkStyle || 0, p.perks?.perkIds[0] || 0, p.perks?.perkSubStyle || 0)
            runesHTML = `
                <img class="bg-[#0d0f10] border border-white/10 rounded" width="22" height="22" src="${runes[0]}">
                <img class="bg-[#0d0f10] border border-white/10 rounded" width="22" height="22" src="${runes[1]}">
            `
        }

        const teamBans = (data.bannedChampions || [])
            .filter(b => b.teamId === p.teamId)
            .sort((a, b) => a.pickTurn - b.pickTurn)

        const banId = teamBans[index]?.championId
        const banName = banId ? getChampionName(banId) : null

        const banHtml = banName
            ? `<img class="rounded" width="52" height="52" src="https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/champion/${banName}.png">`
            : `<div class='min-w-13 min-h-13 bg-[#0d0f10] rounded border border-white/10'></div>`

        // Generating the html for each player from each side.
        return side === 0 ? `
            <li class="flex flex-row items-center min-w-full">
                <div class="ml-5 min-w-13 min-h-13">
                    <img class="absolute rounded" width="52" height="52" src="https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/champion/${champion}.png">
                    <p class="text-[#cdcecf] relative top-10 left-7 bg-[#131619] rounded border border-white/10 font-semibold min-w-8 max-w-8 px-1 text-[11px] flex items-center justify-center min-h-4 max-h-4 z-10">${level}</p>
                </div>
                <div class="ml-3">
                    <div class="flex items-end min-w-60 max-w-60">
                        <h2 class="text-white">${name}</h2>
                        <p class="text-[#9b9c9e] text-[10px] pb-0.5 pl-1">#${tag}</p>
                    </div>
                    <div class="flex gap-1 items-center">
                        ${svg[displayRank[0]] || svg.UNRANKED}
                        <p class="text-[#9b9c9e] font-semibold whitespace-nowrap uppercase text-[12px]">
                            ${displayRank[0] !== "UNRANKED"
                                ? `${displayRank[0]} ${displayRank[1]} <span class="text-[10px]">(${displayRank[2]}LP${displayRank[3]})</span>`
                                : "UNRANKED"
                            }
                        </p>
                    </div>
                </div>
                <div class="border border-zinc-800 h-6 ml-5"></div>
                <div class="flex flex-col gap-2 ml-5">
                    ${sum1}
                    ${sum2}
                </div>
                <div class="flex flex-col gap-2 ml-3">
                    ${runesHTML}
                </div>
                <div class="border border-zinc-800 h-6 mr-5 ml-5"></div>
                ${banHtml}
            </li>
        ` : `
            <li class="flex flex-row items-center justify-end min-w-full">
                ${banHtml}
                <div class="border border-zinc-800 h-6 ml-5 mr-5"></div>
                <div class="flex flex-col gap-2 mr-3">
                    ${runesHTML}
                </div>
                <div class="flex flex-col gap-2 mr-5">
                    ${sum1}
                    ${sum2}
                </div>
                <div class="border border-zinc-800 h-6 mr-5"></div>
                <div class="mr-3 text-right">
                    <div class="flex items-end justify-end min-w-60 max-w-60">
                        <h2 class="text-white">${name}</h2>
                        <p class="text-[#9b9c9e] text-[10px] pb-0.5 pl-1">#${tag}</p>
                    </div>
                    <div class="flex gap-1 items-center justify-end">
                        <p class="text-[#9b9c9e] font-semibold whitespace-nowrap uppercase text-[12px]">
                            ${displayRank[0] !== "UNRANKED"
                                ? `${displayRank[0]} ${displayRank[1]} <span class="text-[10px]">(${displayRank[2]}LP${displayRank[3]})</span>`
                                : "UNRANKED"
                            }
                        </p>
                        ${svg[displayRank[0]] || svg.UNRANKED}
                    </div>
                </div>
                <div class="mr-5 min-w-13 min-h-13">
                    <img class="absolute rounded" width="52" height="52" src="https://ddragon.leagueoflegends.com/cdn/${ddragon}/img/champion/${champion}.png">
                    <p class="text-[#cdcecf] relative top-10 right-2 bg-[#131619] rounded border border-white/10 font-semibold min-w-8 max-w-8 px-1 text-[11px] flex items-center justify-center min-h-4 max-h-4 z-10">${level}</p>
                </div>
            </li>
        `
    }

    const bluePlayers = sortTeamByRoles(data.participants.filter(p => p.teamId === 100))
    let blueTeamHTML = ""
    for (let i = 0; i < bluePlayers.length; i++) {
        blueTeamHTML += await getPlayerHtml(bluePlayers[i], 0, i)
        await new Promise(r => setTimeout(r, 50))
    }

    const redPlayers = sortTeamByRoles(data.participants.filter(p => p.teamId === 200))
    let redTeamHTML = ""
    for (let i = 0; i < redPlayers.length; i++) {
        redTeamHTML += await getPlayerHtml(redPlayers[i], 1, i)
        await new Promise(r => setTimeout(r, 50))
    }

    return `
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&family=Noto+Sans+SC:wght@400;600;700&display=swap" rel="stylesheet">
                <style>${css}</style>
            </head>
            <body class="min-w-270 max-w-270 font-sans tabular-nums bg-[#0d0f10]">
                <div class="w-full h-full">
                    <header class="w-full h-20 bg-[#131619]">
                        <h2 class="text-center text-white font-semibold text-2xl pt-2">ON GOING GAME</h2>
                        <div class="flex justify-around text-[#9b9c9e] pt-2">
                            <p>${spectator.duration}</p>
                            <p>${spectator.gamemode}</p>
                            <p>${spectator.date}</p>
                        </div>
                    </header>
                    <main class="w-full h-120 bg-[#0d0f10] h-50">
                        <header class="flex items-center justify-around py-3 border border-t-white/10 border-b-white/10">
                            <h2 class="text-blue-600 font-semibold pr-100">Blue side</h2>
                            <h2 class="text-red-400">Bans</h2>
                            <h2 class="text-red-500 font-semibold pl-100">Red side</h2>
                        </header>
                        <div class="flex min-h-full bg-[#131619]">
                            <ul class="flex flex-col min-w-[50%] mt-7 gap-5">
                                ${blueTeamHTML}
                            </ul>
                            <div class="border border-zinc-800 min-h-full my-3"></div>
                            <ul class="flex flex-col min-w-[50%] mt-7 gap-5">
                                ${redTeamHTML}
                            </ul>
                        </div>
                    </main>
                </div>
            </body>
        </html>
    `
}

// Process to send a message on Discord.
async function sendMessage(data) {
    try {
        const channel = client.channels.cache.get(SETTINGS.channelID) || await client.channels.fetch(SETTINGS.channelID)

        if (!channel) {
            console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Error: Can not find the Discord channel with ID ${SETTINGS.channelID}`)
            return
        }

        const img = new AttachmentBuilder('./image.png').setName('image.png')

        let text
        const usersList = data.users.join(", ")
        if (data.isLive) {
            text = `🟠 On going game for ${usersList}`
        } else {
            if (data.isWin) text = `🟢 **VICTORY** for *${usersList}*`
            else text = `🔴 **DEFEAT** for *${usersList}*`
        }

        updateActivity()

        await channel.send({ content: text, files: [img] })
        console.log(`[MLV3 - ${new Date().toLocaleTimeString()}] Message sent on Discord !`)
    } catch (error) { console.log(error) }
}

// Process when the bot starts.
client.on("clientReady", async (event) => {
    console.log(`${event.user.tag} is ready !`)
    updateActivity()

    setInterval(updateMatch, SETTINGS.refreshRateMatchMS);
    setInterval(updateSpectator, SETTINGS.refreshRateSpectatorMS);

    const addUserCommand = new SlashCommandBuilder()
        .setName("adduser")
        .setDescription("Add an user.")
        .addStringOption((option) =>
        option
            .setName("region")
            .setDescription("Player's region")
            .setRequired(true)
            .addChoices(
            { name: "Brazil", value: "BR1" },
            { name: "Europe Nordic & East", value: "EUN1" },
            { name: "Europe West", value: "EUW1" },
            { name: "Japan", value: "JP1" },
            { name: "Republic of Korea", value: "KR" },
            { name: "Latin America North", value: "LA1" },
            { name: "Latin America South", value: "LA2" },
            { name: "North America", value: "NA1" },
            { name: "Oceania", value: "OC1" },
            { name: "Turkey", value: "TR1" },
            { name: "Russia", value: "RU" },
            {
                name: "Singapore, Malaysia, Indonesia, The Philippines, Thailand",
                value: "SG2",
            },
            { name: "Taiwan, Hong Kong, and Macao", value: "TW2" },
            { name: "Vietnam", value: "VN2" }
            )
        )
        .addStringOption((option) =>
        option
            .setName("riot_id")
            .setDescription("RIOT ID, like BriarEnjoyer#EUW1")
            .setRequired(true)
        )

    const update = new SlashCommandBuilder()
        .setName("update")
        .setDescription("Force an update.")

    client.application.commands.create(addUserCommand)
    client.application.commands.create(update)
})

// Process on each bot command.
client.on("interactionCreate", async (interaction) => {
    if(!interaction.isChatInputCommand()) return
    if (interaction.commandName === "adduser") {
        const region = interaction.options.getString("region")
        const RiotID = interaction.options.getString("riot_id")
        if (!RiotID.includes("#")) {
            await interaction.reply({ content: "Sorry, wrong RIOT ID format. Needed format : name#tag", flags: MessageFlags.Ephemeral })
            return
        }

        let ID = RiotID.split("#")
        let addedUser = await addUser(ID[0], ID[1], region)

        if (addedUser) {
            await interaction.reply({ content: `You succesfully added ${RiotID}`, flags: MessageFlags.Ephemeral })
            return
        } else {
            await interaction.reply({ content: "Sorry, an error happened while adding a player.", flags: MessageFlags.Ephemeral })
            return
        }

        return
    } else if (interaction.commandName === "update") {
        await interaction.reply({ content: "Update done. (No message = No new game found)", flags: MessageFlags.Ephemeral })
        updateMatch()
        updateSpectator()
        return
    }
})

client.login(process.env.DISCORD_TOKEN)
