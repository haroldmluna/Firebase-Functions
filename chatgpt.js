const functions = require("firebase-functions")
const { Configuration, OpenAIApi } = require("openai")
const { google } = require("googleapis")
const admin = require("firebase-admin")
const vision = require("@google-cloud/vision")

const visionClient = new vision.ImageAnnotatorClient()

const db = admin.firestore()

console.log("Initializing configuration...")

const configuration = new Configuration({
  apiKey: functions.config().openai.api_key,
})

console.log("Creating OpenAI API instance...")

const openai = new OpenAIApi(configuration)

console.log("Initializing Google Custom Search API...")

const customsearch = google.customsearch("v1")
const googleSearchApiKey = functions.config().google.search_api_key
const customSearchEngineId = functions.config().google.custom_search_engine_id

/**
 * Save the conversation for a user in Firestore.
 * @async
 * @param {string} userId - The user identifier.
 * @param {Array} conversation - The conversation history.
 * @throws {Error} If an error occurs while saving the conversation.
 */
async function saveConversation(userId, conversation) {
  try {
    await db
        .collection("conversations")
        .doc(userId)
        .set({ history: conversation })
    console.log("Conversation saved for user:", userId)
  } catch (error) {
    console.error("Error saving conversation:", error)
  }
}

/**
 * Load the conversation history for a user from Firestore.
 * @async
 * @param {string} userId - The user identifier.
 * @return {Array} The conversation history.
 * @throws {Error} If an error occurs while loading the conversation.
 */
async function loadConversation(userId) {
  try {
    const doc = await db.collection("conversations").doc(userId).get()
    if (doc.exists) {
      return doc.data().history
    }
  } catch (error) {
    console.error("Error loading conversation:", error)
  }

  return []
}

/**
 * Searches the web for the given query using the Google Custom Search JSON API.
 * @async
 * @param {string} query - The search query.
 * @return {Promise<Array>} An array of search results.
 * @throws {functions.https.HttpsError} If an error
 * occurs while calling the Google Custom Search API.
 */
async function searchWeb(query) {
  console.log("Performing web search for query:", query)
  try {
    const response = await customsearch.cse.list({
      cx: customSearchEngineId,
      q: query,
      auth: googleSearchApiKey,
    })

    const items = response.data.items || []

    if (items.length === 0) {
      console.warn("No search results found for query:", query)

      return []
    }

    console.log("Search results:", items)

    return items.map((item, index) => {
      return {
        title: item.title,
        link: item.link,
        number: index + 1,
      }
    })
  } catch (error) {
    console.error("Error calling Google Custom Search API:", error)
    throw new functions.https.HttpsError("internal", "An error occurred")
  }
}

const generateText = functions.https.onCall(async (data, context) => {
  const { text, userId, imageData } = data

  let imageDescription = ""

  // Perform image analysis using Google Cloud Vision API
  if (imageData) {
    try {
      const [result] = await visionClient.labelDetection(
          Buffer.from(imageData, "base64"),
      )

      const labels = result.labelAnnotations

      imageDescription = labels.map((label) => label.description).join(", ")

      console.log("Image description:", imageDescription)
    } catch (error) {
      console.error("Error analyzing image:", error)
      throw new functions.https.HttpsError(
          "internal",
          "An error occurred while analyzing the image",
      )
    }
  }

  const conversationHistory = await loadConversation(userId)

  const prompt = `DokiAI, an AI language model based on GPT-4, assists users
   with their questions. Knowledge cutoff: September 2021. 
  For web search, include "search" in the message.

${conversationHistory
      .map((entry) => (entry.isUser ? "User: " : "DokiAI: ") + entry.text)
      .join("\n")}
User: "${text}"
${imageDescription ? `User provided
 an image with the following objects: ${imageDescription}\n` : ""}
DokiAI:`


  console.log("Input text:", text)

  let response
  let generatedText

  try {
    console.log("Calling OpenAI API...")
    response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 150,
      n: 1,
      stop: null,
      temperature: 0.5,
      top_p: 1,
    })
  } catch (error) {
    console.error("Error calling OpenAI API:", error)
    throw new functions.https.HttpsError("internal", "An error occurred")
  }

  console.log("OpenAI API response:", response)

  if (
    response &&
    response.data &&
    response.data.choices &&
    response.data.choices.length > 0
  ) {
    generatedText = response.data.choices[0].text.trim()

    // Search the web for relevant information
    const searchResults =
      text.includes("search") ? await searchWeb(generatedText) : []

    // Process search results and extract citations
    let citations = ""
    if (searchResults.length > 0) {
      citations = searchResults
          .map((result, index) => `[${index + 1}] 
        ${result.title} - ${result.link}`)
          .join("\n")

      // Append citations to the generated text
      generatedText = `${generatedText}\n\nCitations:\n${citations}`
    }

    console.log("Generated text:", generatedText)
  } else {
    console.error("No choices found in the response object:", response)
  }

  const updatedConversationHistory = conversationHistory.concat([
    { isUser: true, text },
    { isUser: false, text: generatedText },
  ])

  await saveConversation(userId, updatedConversationHistory)

  return { generatedText, updatedConversationHistory }
})


module.exports = { generateText, searchWeb }


