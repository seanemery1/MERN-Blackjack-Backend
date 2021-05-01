const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const MUUID = require('uuid-mongodb');
const axios = require("axios");

const MongoClient = require('mongodb').MongoClient;
const uri = "mongodb+srv://sean:passwordSean@cluster0.8ie5k.mongodb.net/<dbname>?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useUnifiedTopology: true });

const app = express();
const jsonParser = bodyParser.json();
app.use(cors());

let database = null;
let collection = null;
async function connectDB(){
    await client.connect();
    database = await client.db("mern-blackjack");
    collection = await database.collection("users-list");
}

connectDB();

const cardValue = {
    "ACE":1,
    "2":2,
    "3":3,
    "4":4,
    "5":5,
    "6":6,
    "7":7,
    "8":8,
    "9":9,
    "10":10,
    "JACK":10,
    "QUEEN":10,
    "KING":10
}
function isAce(card1){
    return (card1===1);
}

function isTwentyOne(playerAce, playerCount) {
    return (playerAce&&(playerCount==11));
}
// if > 21 and 
// function aceIsEleven(playerAce, playerCount) {

function checkForBust(playerCount) {
    return (playerCount>21);
}

// function isBlackJackDraw(card1, card2) {
//     return ((cardValue[card1]===10&&cardValue[card2]===1)
//     ||(cardValue[card1]===1&&cardValue[card2]===10));
// }

function canSplit(card1,card2) {
    return (cardValue[card1]===cardValue[card2]);
}

async function login(req, res) {
    const body = req.body;
    const uuid = MUUID.v4().toString();
    try {
        const result = await collection.findOneAndUpdate(
            {
                _id: body.email
            },
            {
                $setOnInsert: {
                    _id: body.email,
                    name: body.name,
                    email: body.email,
                    password: undefined,
                    balance : 1000,
                    uuid: uuid
                }
            },
            {
                returnNewDocument: false, // return new doc if one is upserted
                upsert: true // insert if document does not exist
            } 
        )
        const newOrUpdatedDocument = result.value;

        let response = {
            isLoggedIn: true,
            email: newOrUpdatedDocument.email,
            name: newOrUpdatedDocument.name,
            password: newOrUpdatedDocument.password,
            uuid: newOrUpdatedDocument.uuid,
            balance: newOrUpdatedDocument.balance
    };
        res.json(response);
    }
    catch (e) {
        if (e.name === 'MongoError' && e.code === 11000) {
            return res.status(422).send({success: true, firstTime: false, message: 'Logging in!'});
        } else {
            return res.status(422).send(e);
        }
    }    
}

app.post('/LogIn', jsonParser, login)

async function getLastGame(req, res) {
    const uuid = req.params.uuid;
    const query = {
        uuid: uuid
    };
    
    let userInfo = await collection.find(query);
    userInfo = await userInfo.toArray();

    userInfo = userInfo[0];

    const collection1 = await database.collection(uuid);
    let gameSession = await collection1.find().sort({_id:-1}).limit(1).toArray();
    gameSession = gameSession[0];

    let response;
    if (gameSession===undefined||Object.entries(gameSession).length === 0) {
        response = {
            isLoggedIn: true,
            name: userInfo.name,
            email: userInfo.email,
            password: userInfo.password,
            balance : userInfo.balance,
            uuid: userInfo.uuid,
            gameID: undefined,
            gameSession: {}
        }
    } else {
        response = {
            isLoggedIn: true,
            name: userInfo.name,
            email: userInfo.email,
            password: userInfo.password,
            balance : userInfo.balance,
            uuid: userInfo.uuid,
            gameID: gameSession['_id'],
            gameSession: gameSession
        }
    }

    res.json(response);
}

app.get('/GetLastGame/:uuid', getLastGame)

async function userProfile(req, res) {

    const uuid = req.params.uuid;

    const query = {uuid:uuid};
    let userCursor = await collection.find(query);
    let profile = await userCursor.toArray();

    const response = profile;
    res.json(response);
}

app.get('/profile/:uuid', userProfile)

async function newGameSession(req, res) {

    const uuid = req.params.uuid;
    const query = {
        uuid: uuid
    };
    let userInfo = await collection.find(query);
    userInfo = await userInfo.toArray();
    userInfo = userInfo[0];
    let deck;
    let shuffled;
    let deckID = req.body.deckID;;
    let remaining;
    if (req.body.resume) {
        console.log(req.body.shuffled);
        console.log(req.body.remaining);
        if (req.body.remaining<156) {
            deck = await fetchAPI(`https://deckofcardsapi.com/api/deck/${deckID}/shuffle/`);
            shuffled = deck.shuffled;
            remaining = deck.remaining;
        } else {
            shuffled = req.body.shuffled;
            remaining = req.body.remaining;
        }
        
    } else {
        const no_decks = 6;
        deck = await fetchAPI(`https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=${no_decks}`);
        deckID = deck.deck_id;
        shuffled = deck.shuffled;
        remaining = deck.remaining;
    }

    console.log(deckID);
    console.log(remaining);
    console.log(shuffled);
    const collection1 = await database.collection(uuid);
    
    const winner = "none";
    const nextMove = "placeBets";

    const insertAndReturn =
    {
        "_id": new Date().toISOString(),
        "nextMove": nextMove,
        "winner-hand": winner,
        "winner-split": winner,
        "canLeave": true,
        "deck": {
            "deckID": deckID,
            "shuffled": shuffled,
            "remaining": remaining
        },
        
        "balance-initial": userInfo.balance,
        "balance-change": 0,
        "available-actions":{
            //"bet": true,
            "split": false,
            "hit": true,
            "double": true,
            "stand": true
        },
        "available-actions-split":{
            //"bet": false,
            "hit": false,
            "double": false,
            "stand": false,
        },
        "player-hand-ace": false,
        "player-hand-count": 0,
        "player-hand-blackjack": false,
        "player-hand-bet": 0,
        "player-hand": [],
        "player-hand-split-ace": false,
        "player-hand-split-count": 0,
        "player-hand-split-blackjack": false,
        "player-hand-split-bet":0,
        "player-hand-split": [],
        "dealer-hand-ace": false,
        "dealer-hand-count": 0,
        "dealer-hand-blackjack": false,
        "dealer-hand": []
    };
    await collection1.insertOne(insertAndReturn);
    let response = [
        {success: true}
    ];
    res.json(insertAndReturn);
}
app.post('/NewGameSession/:uuid', jsonParser, newGameSession)

async function deleteGameSession(req, res) {
    const uuid = req.params.uuid;
    const date = req.params.date;

    // const collection1 =  await database.collection(uuid);
    const doc = {
        _id:date,
        canLeave:true
    };
    const deleteResult = await collection.deleteOne(doc);
    console.log(deleteResult.deletedCount);
    const response = {
        deletedCount: deleteResult.deletedCount
    };
    res.json(response);
}

app.post('/DeleteGameSession/:uuid/:date/', jsonParser, deleteGameSession);

async function placeBets(req, res) {
    console.log("/placebets");
    const uuid = req.params.uuid;
    const date = new Date(req.params.date).toISOString();
    const collection1 =  await database.collection(uuid);

    const filter = {_id:date, 'canLeave':true};
    const updateDocument ={
        $set:{
            'nextMove': 'deal',
            "canLeave": false,
            'player-hand-bet': req.body.bet     
        }
    };

    const result = await collection1.updateOne(filter, updateDocument);
    const response = 
        {matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
        };

    res.json(response);
}
app.post('/NewGameSession/:uuid/:date/PlaceBets', jsonParser, placeBets)

async function firstDeal(req, res) {
    console.log("/firstdeal");
    const uuid = req.params.uuid;
    const date = req.params.date;
    const deckID = req.body.deckID;
    //const database1 =  client.db("mern-blackjack");
    const collection1 = await database.collection(uuid);
    const filter = {_id:date, "nextMove": "deal"};
    console.log(deckID);
    // DECKOFCARDS API CALL
    const cards = await fetchAPI(`https://deckofcardsapi.com/api/deck/${req.body.deckID}/draw/?count=4`);

    let winnerHand;
    let nextMove;
    let canLeave;

    let split = canSplit(cards.cards[0].value, cards.cards[2].value);
    let playerCount = cardValue[cards.cards[0].value]+cardValue[cards.cards[2].value];
    let dealerTrueCount = cardValue[cards.cards[1].value]+cardValue[cards.cards[3].value];
    let dealerHiddenCount = cardValue[cards.cards[3].value];
    if (dealerHiddenCount===1) {
        dealerHiddenCount = 11;
    }
    let playerAce = isAce(cardValue[cards.cards[0].value])||isAce(cardValue[cards.cards[2].value]);
    let dealerAce = isAce(cardValue[cards.cards[1].value])||isAce(cardValue[cards.cards[3].value]);

    let playerBlackjack = isTwentyOne(playerAce, playerCount);
    let dealerBlackjack = isTwentyOne(dealerAce, dealerTrueCount);

    if (playerBlackjack&&dealerBlackjack) {
        canLeave = true;
        nextMove = "dealer";
        winnerHand = "tie";
    } else if (playerBlackjack) {
        canLeave = false;
        nextMove = "dealer";
        winnerHand = "blackjack";
    } else if (dealerBlackjack) {
        canLeave = false;
        nextMove = "player";
        winnerHand = "TBD";
    } else {
        nextMove = "player";
        winnerHand = "TBD";
    }

    if (playerBlackjack) {
        playerCount = 21;
    }
    if (dealerBlackjack) {
        dealerTrueCount = 21;
    }
    
    const updateDocument ={
        $set:{
            "nextMove" : nextMove,
            "winner-hand": winnerHand,
            "winner-split": 'none',
            "canLeave": canLeave,

            "deck": {
                "deckID": cards.deck_id,
                "shuffled": false,
                "remaining": cards.remaining
            },

            "available-actions.split": split,
            
            "available-actions.hit":!playerBlackjack,
            "available-actions.double":!playerBlackjack,

            "player-hand-ace": playerAce,
            "dealer-hand-ace": dealerAce,

            "player-hand-count": playerCount,
            "dealer-hand-count-true": dealerTrueCount,
            "dealer-hand-count-hidden": dealerHiddenCount,

            "player-hand-blackjack": playerBlackjack,
            "dealer-hand-blackjack": dealerBlackjack,  
        },

        $push:{
            "player-hand": {
                $each: [
                    {
                        "code":cards.cards[0].code,
                        "img":cards.cards[0].image,
                        "value":cardValue[cards.cards[0].value]
                    },
                    {
                        "code":cards.cards[2].code,
                        "img":cards.cards[2].image,
                        "value":cardValue[cards.cards[2].value]
                    }
                ]       
            },
            "dealer-hand": {
                $each: [
                    {
                        "code":cards.cards[1].code,
                        "img":cards.cards[1].image,
                        "value":cardValue[cards.cards[1].value]
                    },
                    {
                        "code":cards.cards[3].code,
                        "img":cards.cards[3].image,
                        "value":cardValue[cards.cards[3].value]
                    }
                ]       
            },

         }
    };
    const result = await collection1.updateOne(filter, updateDocument);
    const response2 = 
        {matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount}
    ;
    res.json(response2);
}
app.post('/NewGameSession/:uuid/:date/Deal', jsonParser, firstDeal)

async function split(req, res) {
    console.log("split");
    const uuid = req.params.uuid;
    const date = req.params.date;
    const deckID = req.body.deckID;

    const collection1 = await database.collection(uuid);
    const query = {_id: date, "available-actions.split": true};
   
    const player = await collection1.findOne(query);
    
    if (player!==undefined) {
        //console.log(player['player-hand'][0].code);
        const cards = await fetchAPI(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`);
        const updateDocument1 ={
            $push:{
                "player-hand-split": {
                    $each: [
                        {
                            "code":player['player-hand'][0].code,
                            "img":player['player-hand'][0].img,
                            "value":player['player-hand'][0].value
                        }
                    ]   
                },
                "player-hand": {
                    $each: [
                        {
                            "code": cards.cards[0].code,
                            "img": cards.cards[0].image,
                            "value": cardValue[cards.cards[0].value]
                        }
                    ]   
                }      
            }
        }
        const result1 = await collection1.updateOne(query, updateDocument1);
        
        const playerCount =  player['player-hand'][1].value + cardValue[cards.cards[0].value];
        const playerAce = isAce(cardValue[cards.cards[0].value])||isAce(player['player-hand'][1].value);
        const splitAce = isAce(player['player-hand'][0].value);
        const splitCount = player['player-hand'][0].value;
        const splitBet =  player['player-hand-bet'];
    
        let nextMove;
        let winnerHand;
        if (isTwentyOne(playerAce, playerCount)) {
            nextMove = "split";
            winnerHand = 'blackjack';
        } else {
            nextMove = "player";
            winnerHand = "TBD";
        }
    
        const updateDocument2 = {
            $set:{
                "nextMove": nextMove,
                "winner-hand": winnerHand,
                "winner-split": 'TBD',
                "deck.deckID": cards.deck_id,
                "deck.shuffled": false,
                "deck.remaining": cards.remaining,
               

                "available-actions.split": false,
                "available-actions-split.double": true,
                "available-actions-split.hit": true,
                "available-actions-split.stand": true,
                "player-hand-blackjack": isTwentyOne(playerAce, playerCount),
                "player-hand-ace": playerAce,
                "player-hand-count": playerCount,
                "player-hand-split-ace": splitAce,
                "player-hand-split-count": splitCount,
                "player-hand-split-bet": splitBet
            },
            $pop:{
                "player-hand": -1   
            }
        }
        const result2 = await collection1.updateOne(query, updateDocument2);
        let response = 
            {matchedCount: result2.matchedCount,
            modifiedCount: result2.modifiedCount,
            success: true}
        ;
        res.json(response);

    } else {
        return res.status(422).send({success: false, message: 'Cannot split, cards are not of equal value!'});
    }    
}
app.post('/NewGameSession/:uuid/:date/Split', jsonParser, split)

async function hit(req, res) {
    console.log("/hit");
    const uuid = req.params.uuid;
    const date = req.params.date;
    const hand = req.params.hand;
    const deckID = req.body.deckID;
    const double = req.body.double;
    const collection1 = await database.collection(uuid);
    const query = {_id:date};
    const player = await collection1.findOne(query);

    if (player!==undefined) {

        const cards = await fetchAPI(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`);
        let updateDocument1;
        let nextMove;
        let splitHit = false;
        let splitStand = false;
        let splitDouble = false;

        let handHit = false;
        let handStand = false;
        let handDouble = false;
        let winnerHand = 'TBD';
        if (hand==='OriginalHand') {
            if (player['player-hand-count']+cardValue[cards.cards[0].value]<21&&!isTwentyOne(player['player-hand-ace'], player['player-hand-count'])) {
                if (double) {
                    nextMove = 'dealer';
                } else {
                    nextMove = 'player';
                }
                
            } else {
                if (player['player-hand-split-count']!==0) {
                    nextMove = 'split';
                    splitHit = true;
                    splitStand = true;
                    splitDouble = true;
                } else {
                    nextMove = 'dealer';
                }
                winnerHand = 'bust';
            }
            

            if (!double) {
                handHit = (player['player-hand-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-ace']===1||isAce(cards.cards[0].value)));
                handStand = (player['player-hand-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-ace']===1||isAce(cards.cards[0].value)));
                handDouble = (player['player-hand-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-ace']===1||isAce(cards.cards[0].value)));
            }
            updateDocument1 = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'winner-hand': winnerHand,
                    'nextMove': nextMove,
                    'available-actions.split': false,
                    'available-actions.hit': handHit,
                    'available-actions.double': handDouble,
                    'available-actions.stand': handStand ,
    
                    'player-hand-ace': player['player-hand-ace']===1||isAce(cards.cards[0].value),
                    'player-hand-count': player['player-hand-count']+cardValue[cards.cards[0].value],
                    'player-blackjack': (player['player-hand-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-ace']===1||isAce(cards.cards[0].value)))
                    ||(player['player-hand-count']+cardValue[cards.cards[0].value]===21),

                    'available-actions-split.hit': splitHit,
                    'available-actions-split.hit': splitStand,
                    'available-actions-split.hit': splitDouble
                },
                $push:{
                    'player-hand': {
                        $each: [
                            {
                                "code":cards.cards[0].code,
                                "img":cards.cards[0].image,
                                "value":cardValue[cards.cards[0].value]
                            }
                        ]   
                    }    
                }
            }
            
        } else {
            if (player['player-hand-split-count']+cardValue[cards.cards[0].value]<21&&!isTwentyOne(player['player-hand-split-ace'], player['player-hand-split-count'])) {
                
                

                winnerHand = 'TBD';
                if (double) {
                    nextMove = 'dealer';
                } else {
                    nextMove = 'split';
                }
                splitHit = true;
                if (player['player-hand-split'].length==2) {
                    splitStand = true;
                    splitDouble = true;
                }
                    
            } else {
                nextMove = 'dealer';
                winnerHand = 'bust';
            }

            if (!double) {
                splitHit = (player['player-hand-split-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-split-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-split-ace']===1||isAce(cards.cards[0].value)));

                splitDouble = (player['player-hand-split-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-split-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-split-ace']===1||isAce(cards.cards[0].value)));

                splitStand = (player['player-hand-split-count']+cardValue[cards.cards[0].value]<21)
                ||(player['player-hand-split-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-split-ace']===1||isAce(cards.cards[0].value)));
            }
            updateDocument1 = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'winner-split': winnerHand,
                    'nextMove': nextMove,
                    'available-actions.split': false,
                    'available-actions.hit': false,
                    'available-actions.double': false,
                    'available-actions.stand': false,
    
                    'player-hand-split-ace': player['player-hand-split-ace']===1||isAce(cards.cards[0].value),
                    'player-hand-split-count': player['player-hand-split-count']+cardValue[cards.cards[0].value],
                    'player-hand-split-blackjack': (player['player-hand-split-count']+cardValue[cards.cards[0].value]===11&&(player['player-hand-split-ace']===1||isAce(cards.cards[0].value)))
                    ||(player['player-hand-split-count']+cardValue[cards.cards[0].value]===21),

                    'available-actions-split.hit': splitHit,
                    'available-actions-split.hit': splitStand,
                    'available-actions-split.hit': splitDouble
                },
                $push:{
                    'player-hand-split': {
                        $each: [
                            {
                                "code":cards.cards[0].code,
                                "img":cards.cards[0].image,
                                "value":cardValue[cards.cards[0].value]
                            }
                        ]   
                    }    
                }
            }
        }
        const result = await collection1.updateOne(query, updateDocument1);
        let response = {nextMove: nextMove};
        res.json(response);
        
    } else {
        let response = 
            {nextMove: 'player'}
        ;
        res.json(response);
    }
}
app.post('/NewGameSession/:uuid/:date/Hit/:hand', jsonParser, hit)

async function standDouble(req, res) {
    console.log("/stand");
    const uuid = req.params.uuid;
    const date = req.params.date;
    const hand = req.params.hand;
    const double = req.body.double;
    const deckID = req.body.deckID;
    const collection1 = await database.collection(uuid);
    const query = {_id:date};
    const player = await collection1.findOne(query);

    if (player!==undefined) {
        let nextMove;
        //const cards = await fetchAPI(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`);
        let updateDocument1;
        let betAmount;
        let winnerHand;
        

        if (hand==='OriginalHand') {
            if (double) {
                winnerHand = 'TBD';
                betAmount = 2*player['player-hand-bet'];
            } else {
                winnerHand = 'TBD';
                betAmount = player['player-hand-bet'];
            }
            if (player['player-hand-split-count']!==0) {
                nextMove = 'split';
            } else {
                nextMove = 'dealer';
            }
            
            updateDocument1 = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'available-actions.split': false,
                    'available-actions.hit':false,
                    'available-actions.double':false,
                    'available-actions.stand':false,
                    'player-hand-bet': betAmount,
                    'nextMove': nextMove,
                    'winner-hand': winnerHand
                }  
            }
        } else {
            if (double) {
                winnerHand = 'TBD';
                betAmount = 2*player['player-hand-split-bet'];
            } else {
                winnerHand = 'TBD';
                betAmount = player['player-hand-split-bet'];
            }
            nextMove = 'dealer';
            updateDocument1 = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'available-actions.split': false,
                    'available-actions-split.hit': false,
                    'available-actions-split.double':false,
                    'available-actions-split.stand':false,
                    'player-hand-bet': betAmount,
                    'nextMove': nextMove,
                    'winner-split': winnerHand
                }
            }
        }
        const result = await collection1.updateOne(query, updateDocument1);
        let response = {
            nextMove: nextMove
        };
        
        res.json(response);
        // if (nextMove==='split'&&player['player-hand-split'].length===1) {
        //     hit(`/NewGameSession/${uuid}/${date}/Hit/SplitHand`, jsonParser, hit);
        // } else if (double) {
        //     app.post(`/NewGameSession/${uuid}/${date}/Hit/OriginalHand`, jsonParser, hit);
        // }
    } else {
        let response = {
            nextMove: nextMove,
            hand: hand
        };
        res.json(response);
    }
}

app.post('/NewGameSession/:uuid/:date/StandDouble/:hand', jsonParser, standDouble)





async function dealer(req, res) {
    console.log("/dealer");
    const uuid = req.params.uuid;
    const date = req.params.date;
    const deckID = req.body.deckID;

    const collection1 = await database.collection(uuid);
    const query = {_id:date};
    const player = await collection1.findOne(query);

    if (player!==undefined) {
        let balanceChange = 0;

        let playerHandCount = player['player-hand-count'];
        if (player['player-hand-ace']&&(player['player-hand-count']+10)<=21) {
            playerHandCount = player['player-hand-count'] + 10;
        }

        let playerSplitCount = player['player-hand-split-count'];
        if (player['player-hand-split-ace']&&(player['player-hand-split-count']+10)<=21) {
            playerSplitCount = player['player-hand-split-count'] + 10;
        }

        let dealerHandCount = player['dealer-hand-count-true'];
        if (player['dealer-hand-ace']&&(player['dealer-hand-count-true']+10)<=21) {
            dealerHandCount = player['dealer-hand-count-true'] + 10;
        }

        if (playerHandCount>21&&playerSplitCount>21) {
            let nextMove = 'nextGame';
            balanceChange = balanceChange - player['player-hand-bet'] - player['player-hand-split-bet'];
            let updateDocument = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'winner-hand': 'bust',
                    'winner-split': 'bust',
                    'nextMove': nextMove,
                    'canLeave': true,
                    'balance-change': balanceChange
                }
            }
            const result = await collection1.updateOne(query, updateDocument);

            const query1 = {uuid: uuid};
            let updateDocument1 = {
                $set:{
                    'balance': player['balance-initial'] + balanceChange
                }
            };
            let userInfo = await collection.updateOne(query1, updateDocument1);
            let response = {nextMove: nextMove};
            res.json(response);
        } else if (playerHandCount>21&&playerSplitCount===0) {
            balanceChange = balanceChange - player['player-hand-bet'];
            // change score
            // return
            let nextMove = 'nextGame';
            let updateDocument = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'winner-hand': 'bust',
                    'winner-split': 'none',
                    'nextMove': nextMove,
                    'canLeave': true,
                    'balance-change': balanceChange
                }
            };
            const result = await collection1.updateOne(query, updateDocument);

            const query1 = {uuid: uuid};
            let updateDocument1 = {
                $set:{
                    'balance': player['balance-initial'] + balanceChange
                }
            };
            let userInfo = await collection.updateOne(query1, updateDocument1);
            let response = {nextMove: nextMove};
            res.json(response);
        } else if (dealerHandCount<17) {
            let nextMove = 'dealer';
            const cards = await fetchAPI(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`);
            let updateDocument = {
                $set:{
                    // if sum is < 21 or sum === 11 and contains ace
                    'winner-hand': 'TBD',
                    'nextMove': nextMove,
                    
                    'dealer-hand-ace': player['dealer-hand-ace']===1||isAce(cards.cards[0].value),
                    'dealer-hand-count-true': player['dealer-hand-count-true'] + cardValue[cards.cards[0].value],
                    "deck.deckID": cards.deck_id,
                    "deck.shuffled": false,
                    "deck.remaining": cards.remaining
                    
                },
                $push:{
                    'dealer-hand': {
                        $each: [
                            {
                                "code":cards.cards[0].code,
                                "img":cards.cards[0].image,
                                "value":cardValue[cards.cards[0].value]
                            }
                        ]   
                    }    
                }
            };
            const result = await collection1.updateOne(query, updateDocument);
            let response = {nextMove: nextMove};
            res.json(response);


        } else if (dealerHandCount>21) {
            let winnerHand = player['winner-hand'];
            let winnerSplit = player['winner-split'];
            let balanceChange = 0;
            let nextMove = 'nextGame';
            if (playerHandCount<=21) {
                winnerHand = 'player';
                balanceChange = balanceChange + player['player-hand-bet'];
            }
            if (playerSplitCount<=21&&playerSplitCount!==0) {
                winnerSplit = 'player';
                balanceChange = balanceChange + player['player-hand-split-bet'];
            }
            let updateDocument = {
                $set:{
                    'winner-hand': winnerHand,
                    'winner-split': winnerSplit,
                    'balance-change': balanceChange,
                    'nextMove': nextMove,
                    'canLeave': true,
                }
            };
            const result = await collection1.updateOne(query, updateDocument);

            const query1 = {uuid: uuid};
            let updateDocument1 = {
                $set:{
                    'balance': player['balance-initial'] + balanceChange,
                }
            };
            let userInfo = await collection.updateOne(query1, updateDocument1);
            let response = {nextMove: nextMove};
            res.json(response);

        } else {
            let winnerHand = player['winner-hand'];
            let winnerSplit = player['winner-split'];
            let balanceChange = 0;
            let nextMove = 'nextGame';
            if (dealerHandCount>playerHandCount) {
                winnerHand = 'dealer';
                balanceChange = balanceChange - player['player-hand-bet'];
            } else if (dealerHandCount===playerHandCount){
                winnerHand = 'tie';
            } else {
                winnerHand = 'player';
                balanceChange = balanceChange + player['player-hand-bet'];
            }
            if (dealerHandCount>playerSplitCount&&playerSplitCount!==0) {
                winnerSplit = 'dealer';
                balanceChange = balanceChange - player['player-hand-split-bet'];
            } else if (dealerHandCount===playerSplitCount) {
                winnerSplit = 'tie';
            } else if (dealerHandCount<playerSplitCount&&playerSplitCount!==0) {
                winnerSplit = 'player';
                balanceChange = balanceChange + player['player-hand-bet'];
            }
            let updateDocument = {
                $set:{
                    'winner-hand': winnerHand,
                    'winner-split': winnerSplit,
                    'balance-change': balanceChange,
                    'nextMove': nextMove,
                    'canLeave': true,
                }
            };
            const result = await collection1.updateOne(query, updateDocument);

            const query1 = {uuid: uuid};
            let updateDocument1 = {
                $set:{
                    'balance': player['balance-initial'] + balanceChange,
                }
            };
            let userInfo = await collection.updateOne(query1, updateDocument1);
            let response = {nextMove: nextMove};
            res.json(response);
        }
    }
}

app.post('/NewGameSession/:uuid/:date/Dealer', jsonParser, dealer)






















async function fetchAPI(url) {
    let response = await axios.get(url);
    return response.data;
}

app.listen(5000, function(){
    console.log("Server is running on port 5000")
})


   // let playerCount;
    // let playerAce;
    // if (hand==='OriginalHand') { // if original hand is selected
    //     playerCount ='player-hand-count';
    //     playerAce = 'player-hand-ace';
    //     playerHand = 'player-hand';
    //     playerBlackjack = 'player-blackjack';
    //     playerActionsHit = 'available-actions.hit';
    //     playerActionsDouble = 'available-actions.double';
    //     playerActionsStand = 'available-actions.stand';
    // } else { // if split is selected
    //     playerCount ='player-hand-split-count';
    //     playerAce = 'player-hand-split-ace';
    //     playerHand = 'player-hand-split';
    //     playerBlackjack = 'player-blackjack-split';
    //     playerActionsHit = 'available-actions-split.hit';
    //     playerActionsDouble = 'available-actions-split.double';
    //     playerActionsStand = 'available-actions-split.stand';

/*
//const database1 =  client.db("mern-blackjack");
    //https://stackoverflow.com/questions/24300148/pull-and-addtoset-at-the-same-time-with-mongo
    // let bulk =  database.collection(UUID.toString())
    // .initializeOrderedBulkOp();
    // let filter = {_id:date, "available-actions.split":true};
    // bulk.find({_id:date, "available-actions.split":true})
    // .updateOne({$set:{"available-actions.split":false}});
    // bulk.find({_id:date})
    // .updateOne({$pull:{$arrayElemAt:["player-hand",-1]}});
    // bulk.find({_id:date, })
    // .updateOne({$pull:{$arrayElemAt:["player-hand",-1]}});
    // bulk.find({_id:date})
    // .updateOne({$addToSet:{$arrayElemAt:["player-hand",-1]}});

    // const updateDocument2 ={
    //     $set:{
    //         "available-actions.split":false
    //     },
    //     $pull:{
    //         $arrayElemAt:["player-hand",-1],
    //         $arrayElemAt:["player-hand-split",0]
    //     }
    // }
    // const result = await collection1.updateOne(query, updateDocument);

    // DECKOFCARDS API CALL
    //const cards = await fetchAPI('https://deckofcardsapi.com/api/deck/lxk97yck92vm/draw/?count=4');
//     console.log(hands);
//     [
    
//         {
//             $match: {
//                 _id:date
//             }
//         },
//         {
//             $project: { "player-hand":1, "player-hand-split":1, "player-hand-split": { $setUnion: [ "$player-hand", [] ]} }
//         }
//     ]
// );
    // let villagers = await villagersCursor.toArray();
    // const updateDocument ={
    //     $set:{
    //         "available-actions.split":false
    //     },
    //     $pull:{
    //         $arrayElemAt: [
    //             "player-hand":1, -1 
    //         ]
            
    //         "dealer-hand": {
    //             $each: [
    //                 {
    //                 "code":cards.cards[1].code,
    //                 "img":cards.cards[1].image,
    //                 "value":cardValue[cards.cards[1].value]
    //                 },
    //                 {
    //                 "code":cards.cards[3].code,
    //                 "img":cards.cards[3].image,
    //                 "value":cardValue[cards.cards[3].value]
    //                 }
    //             ]       
    //         },

    //      }
    // };
    // const result = await database.runCommand({
    //     findAndModify: UUID.toString(),
    //     query: {_id:date},
    //     update: {
    //         $addToSet: {
    //             "player-hand-split": {
    //                 $each: collection1.find(
    //                     {"title": "ABC"},
    //                     {"_id": 0, "admins": 1}
    //                 ).next().admins
    //             }
    //         }
    //     }
    // })
    
    // ;
*/