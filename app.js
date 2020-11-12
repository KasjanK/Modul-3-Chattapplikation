(function () {
  let dataConnection = null;
  let mediaConnection = null;
  // get peer id from URL
  const myPeerId = location.hash.slice(1);

  // get html elements
  const peersEl = document.querySelector(".peers");
  const sendButtonEl = document.querySelector(".send-new-message-button");
  const newMessageEl = document.querySelector(".new-message");
  const messagesEl = document.querySelector(".messages");
  const listPeersButtonEl = document.querySelector(".list-all-peers-button");
  const theirVideoContainer = document.querySelector(".video-container.them");
  const videoOfThemEl = document.querySelector(".video-container.them video");
  const videoOfMeEl = document.querySelector(".video-container.me video");

  // activate camera
  navigator.mediaDevices
    .getUserMedia({ audio: false, video: true })
    .then((stream) => {
      videoOfMeEl.muted = true;
      videoOfMeEl.srcObject = stream;
    });

  const printMessage = (text, who) => {
    function addZero(i) {
      if (i < 10) {
        i = "0" + i;
      }
      return i;
    }
    let today = new Date();
    let time =
      addZero(today.getHours()) +
      ":" +
      addZero(today.getMinutes()) +
      ":" +
      addZero(today.getSeconds());
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", who);
    messageEl.innerHTML = `<div>${time} ${text}</div>`;
    messagesEl.append(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  };

  // connect to peer server
  let peer = new Peer(myPeerId, {
    host: "glajan.com",
    port: 8443,
    path: "/myapp",
    secure: true,
    config: {
      iceServers: [
        { urls: ["stun:eu-turn7.xirsys.com"] },
        {
          username:
            "1FOoA8xKVaXLjpEXov-qcWt37kFZol89r0FA_7Uu_bX89psvi8IjK3tmEPAHf8EeAAAAAF9NXWZnbGFqYW4=",
          credential: "83d7389e-ebc8-11ea-a8ee-0242ac140004",
          urls: [
            "turn:eu-turn7.xirsys.com:80?transport=udp",
            "turn:eu-turn7.xirsys.com:3478?transport=udp",
            "turn:eu-turn7.xirsys.com:80?transport=tcp",
            "turn:eu-turn7.xirsys.com:3478?transport=tcp",
            "turns:eu-turn7.xirsys.com:443?transport=tcp",
            "turns:eu-turn7.xirsys.com:5349?transport=tcp",
          ],
        },
      ],
    },
  });

  // print peer id on connection "open" event
  peer.on("open", (id) => {
    const myPeerIdEl = document.querySelector(".my-peer-id");
    myPeerIdEl.innerText = id;
  });

  // error message if there is an error
  peer.on("error", (errorMessage) => {
    console.error(errorMessage);
  });

  // on incoming connection
  peer.on("connection", (connection) => {
    // close existing connection and set new connection
    dataConnection && dataConnection.close();
    dataConnection = connection;

    const event = new CustomEvent("peer-changed", { detail: connection.peer });
    document.dispatchEvent(event);
  });

  // event listener for incoming video call.
  peer.on("call", (incomingCall) => {
    mediaConnection && mediaConnection.close();

    // change state on start/stop connection
    startVideoButton.classList.remove("active");
    stopVideoButton.classList.add("active");

    // answering the incoming call
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((myStream) => {
        incomingCall.answer(myStream);
        mediaConnection = incomingCall;
        mediaConnection.on("stream", (theirStream) => {
          videoOfThemEl.muted = true;
          videoOfThemEl.srcObject = theirStream;
        });
      });
  });

  // event listener for click "refresh list"
  listPeersButtonEl.addEventListener("click", (e) => {
    peer.listAllPeers((peers) => {
      // add peers to html document
      const peersList = peers
        // filter out our own name
        .filter((peerId) => peerId !== peer._id)
        // loop through all peers and print them as buttons in a list
        .map((peer) => {
          return `
        <li>
        <button class="connect-button peerId-${peer}">${peer}</button>
        </li>
        `;
        })
        .join("");
      peersEl.innerHTML = `<ul>${peersList}</ul>`;
    });
  });
  peersEl.addEventListener("click", (e) => {
    if (!e.target.classList.contains("connect-button")) return;

    // get peerId from button element
    const theirPeerId = e.target.innerText;

    // close existing connection
    dataConnection && dataConnection.close();

    // connect to peer
    dataConnection = peer.connect(theirPeerId);

    dataConnection.on("open", () => {
      // dispatch event with peer id
      const event = new CustomEvent("peer-changed", { detail: theirPeerId });
      document.dispatchEvent(event);
    });
  });

  // event listener for custom event "peer-changed"
  document.addEventListener("peer-changed", (e) => {
    const peerId = e.detail;

    // get clicked button
    const connectButtonEl = document.querySelector(
      `.connect-button.peerId-${peerId}`
    );

    // remove "connected" on all other peers
    document.querySelectorAll(".connect-button").forEach((button) => {
      button.classList.remove("connected");
    });

    // add class "connected" to clicked button
    connectButtonEl && connectButtonEl.classList.add("connected");

    // listen for incoming data/message
    dataConnection.on("data", (textMessage) => {
      printMessage(textMessage, "them");
    });

    // set focus on text input field
    newMessageEl.focus();

    theirVideoContainer.querySelector(".name").innerText = peerId;
    theirVideoContainer.classList.add("connected");
    theirVideoContainer.querySelector(".start").classList.add("active");
    theirVideoContainer.querySelector(".stop").classList.remove("active");
  });

  // send message to peer
  const sendMessage = (e) => {
    if (!dataConnection) return;
    if (newMessageEl.value === "") return;

    if (e.type === "click" || e.keyCode === 13) {
      dataConnection.send(newMessageEl.value);
      printMessage(newMessageEl.value, "me");
      // clear text input field
      newMessageEl.value = "";
    }
    // set focus on text input field
    newMessageEl.focus();
  };
  // event listener for click on "send"
  sendButtonEl.addEventListener("click", sendMessage);
  newMessageEl.addEventListener("keyup", sendMessage);

  // event listener for the "start video chat" button
  const startVideoButton = document.querySelector(".start");
  const stopVideoButton = document.querySelector(".stop");
  startVideoButton.addEventListener("click", () => {
    startVideoButton.classList.remove("active");
    stopVideoButton.classList.add("active");

    // start video call with remote peer
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: true })
      .then((myStream) => {
        mediaConnection && mediaConnection.close();
        const theirPeerId = dataConnection.peer;
        mediaConnection = peer.call(theirPeerId, myStream);
        mediaConnection.on("stream", (theirStream) => {
          videoOfThemEl.muted = true;
          videoOfThemEl.srcObject = theirStream;
        });
      });
  });
  // event listener for click 'hang up'
  stopVideoButton.addEventListener("click", () => {
    stopVideoButton.classList.remove("active");
    startVideoButton.classList.add("active");
    mediaConnection && mediaConnection.close();
  });
})();
