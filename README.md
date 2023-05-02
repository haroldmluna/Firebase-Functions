# Firebase-Functions
This repository contains the implementation of Firebase Cloud Functions to power a conversational AI assistant using OpenAI's GPT-4 and Google Cloud Vision API. The assistant provides users with relevant information, performs web searches, and interacts with Firestore to maintain conversation history.

#Features
Conversational AI using OpenAI GPT-4
Web search using Google Custom Search JSON API
Image analysis using Google Cloud Vision API
User conversation history management using Firestore
Prerequisites
Node.js installed
Firebase CLI installed
Google Cloud SDK installed
Firebase project set up
OpenAI API key
Google Custom Search API key

#Installation
1 - Clone the repository:
git clone https://github.com/haroldmluna/Firebase-Functions.git

2- Change directory to the project folder:
bash
Copy code
cd Firebase-Functions
Install dependencies:
bash
Copy code
npm install

3 - Set up Firebase configuration:
bash
Copy code
firebase use --add your-firebase-project-id
Add your OpenAI API key and Google Custom Search API key to the Firebase functions configuration:
bash
Copy code
firebase functions:config:set openai.api_key="your-openai-api-key" google.search_api_key="your-google-search-api-key" google.custom_search_engine_id="your-google-custom-search-engine-id"
Deploy the functions to Firebase:
bash
Copy code
firebase deploy --only functions
Usage
After deploying the functions, you can use the generatedText function in your frontend application to communicate with the AI assistant. The function accepts an object containing the text input, user ID, and optional image data.

javascript
Copy code
const data = {
  text: "your input text",
  userId: "your user ID",
  imageData: "optional base64-encoded image data",
};

const response = await firebase.functions().httpsCallable("generateText")(data);
The response object will contain the generated text and the updated conversation history.

License
This project is licensed under the MIT License. See the LICENSE file for details.
