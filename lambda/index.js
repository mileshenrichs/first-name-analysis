const Alexa = require('ask-sdk');
const analysisSentences = require('./analysisSentences');

// length of array which contains name analysis sentences
const SENTENCE_LIST_LENGTH = analysisSentences.nameSentences.length;

function setName(handlerInput) {
	// get name from intent slot
	const intent = handlerInput.requestEnvelope.request.intent;
	const name = intent.slots.Name.value;

	// set name session attribute
	handlerInput.attributesManager.setSessionAttributes({name});

	// acknowledge name and prompt for gender
	const speechOutput = `Hi, ${name}. What's your gender?`;
	return handlerInput.responseBuilder
		.speak(speechOutput)
		.reprompt(speechOutput)
		.getResponse();
}

function setGender(handlerInput) {
	// get gender from intent slot
	const intent = handlerInput.requestEnvelope.request.intent;
	const gender = intent.slots.Gender.value;

	// set gender session attribute
	let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
	sessionAttributes.gender = gender;
	handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

	// now that we have name and gender, offer name analysis
	return offerNameAnalysis(handlerInput);
}

function offerNameAnalysis(handlerInput) {
	const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
	const { name, gender } = sessionAttributes;

	let nameAnalysis = computeNameAnalysis(name, gender);

	// sentence should use 'a' or 'an' depending on first letter of name
	let indefiniteArticle = ['a', 'e', 'i', 'o', 'u'].includes(name.charAt(0).toLowerCase()) ? 'an' : 'a';

	const speechOutput = `As ${indefiniteArticle} ${name}, ${nameAnalysis} Would you like to try another name?`;
	return handlerInput.responseBuilder
		.speak(speechOutput)
		.getResponse();
}

// util function to compute 3-sentence name analysis given a name and gender.
// Algorithm used is illustrated in github project README
function computeNameAnalysis(name, gender) {
	let sentenceIndices = [];

	// use standard algorithm if name at least 3 letters long
	if(name.length >= 3) { 
		for(var i = 0; i < 3; i++) {
		  // indexProduct is computed from letters in name to determine 
		  // which sentences to use for name analysis
		  let indexProduct = i + 1;
		  
		  // indexProduct computed by calculating product of alphabetical indices of 
		  // all letters in name excluding current letter (i), multiplied by value of i + 1
		  for(var j = 0; j < name.length; j++) {
		    if(j !== i) {
		      indexProduct *= getAlphabeticalIndex(name.charAt(j));
		    }
		  }
		  
		  // add one to indexProduct if gender is female
		  if(gender === 'female') {
		    indexProduct += 1;
		  }
		  
		  // assign product to sentence by computing it mod the number of sentences,
		  // then push to sentenceIndices array
		  sentenceIndices.push(indexProduct % SENTENCE_LIST_LENGTH);
		}
	} else { // use alternative algorithm if name has only 2 letters

		genderFactor = gender === 'female' ? 1 : 0;

		// get alphabetical indices of each letter and their sum
		const firstLetterIndex = genderFactor + getAlphabeticalIndex(name.charAt(0));
		const secondLetterIndex = genderFactor + getAlphabeticalIndex(name.charAt(1));
		const letterSum = genderFactor + firstLetterIndex + secondLetterIndex;

		// compute sentence indices
		sentenceIndices.push((letterSum * firstLetterIndex) % SENTENCE_LIST_LENGTH);
		sentenceIndices.push((letterSum * secondLetterIndex) % SENTENCE_LIST_LENGTH);
		sentenceIndices.push((firstLetterIndex * secondLetterIndex) % SENTENCE_LIST_LENGTH);
	}

	// concatenate sentences from analysisSentences according to sentenceIndices
	const { nameSentences } = analysisSentences;
	return nameSentences[sentenceIndices[0]] + ' ' + nameSentences[sentenceIndices[1]] + ' ' + nameSentences[sentenceIndices[2]];
}

// util function to convert letter to its index in the alphabet
function getAlphabeticalIndex(letter) {
  return parseInt(letter, 36) - 9;
}

const LaunchRequest = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;

		// handle as launch request for either initial launch or start over
	    return request.type === 'LaunchRequest'
	      || (request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StartOverIntent');
	},
	handle(handlerInput) {
		const speechOutput = 'Welcome to Name Analysis. I can help you understand whether your first name is helping or hurting you. Please tell me your first name.';
		return handlerInput.responseBuilder
			.speak(speechOutput)
			.reprompt(speechOutput)
			.getResponse();
	}
};

const GiveName = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;
		return request.type === 'IntentRequest' && request.intent.name === 'GiveNameIntent';
	},
	handle(handlerInput) {
		return setName(handlerInput);
	}
};

const GiveGender = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;
		return request.type === 'IntentRequest' && request.intent.name === 'GiveGenderIntent';
	},
	handle(handlerInput) {
		return setGender(handlerInput);
	}
};

const YesIntent = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;
		return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent';
	},
	handle(handlerInput) {
		// reset session attributes in preparation for restart
		handlerInput.attributesManager.setSessionAttributes({});
		const speechOutput = 'Great, let\'s go again!  What is your first name?';
		return handlerInput.responseBuilder
			.speak(speechOutput)
			.reprompt(speechOutput)
			.getResponse();
	}
};

const NoIntent = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;
		return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent';
	},
	handle(handlerInput) {
		const speechOutput = 'Thank you for trying Name Analysis. Remember your name can both help you and hurt you!';
		return handlerInput.responseBuilder
			.speak(speechOutput)
			.getResponse();
	}
};

const FallbackIntent = {
	canHandle(handlerInput) {
		const { request } = handlerInput.requestEnvelope;
		return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.FallbackIntent';
	},
	handle(handlerInput) {
		let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
		let speechOutput;

		// if don't have name or gender, probably was prompting for name
		if(!(sessionAttributes.name || sessionAttributes.gender)) {
			speechOutput = 'Whoops, I had some trouble understanding your name.  Please try repeating it.';
		} else if (sessionAttributes.name && !sessionAttributes.gender) { // if only have name, probably prompting gender
			speechOutput = 'Oops, I didn\'t understand what your gender is.  Could you repeat it?';
		} else { // if have both, who knows
			speechOutput = 'Sorry, what was that?';
		}

		return handlerInput.responseBuilder
			.speak(speechOutput)
			.reprompt(speechOutput)
			.getResponse();
	}
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequest,
    GiveName,
    GiveGender,
    YesIntent,
    NoIntent,
    FallbackIntent
  ).lambda();