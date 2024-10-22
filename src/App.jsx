import { useRef, useEffect } from "react";
import { useMachine } from "@xstate/react";
import Hls from "hls.js";
import { fromCallback, setup } from "xstate";

const resizeLogic = fromCallback(({ sendBack, receive }) => {
  const resizeHandler = (event) => {
    sendBack(event);
  };

  window.addEventListener("resize", resizeHandler);

  const removeListener = () => {
    window.removeEventListener("resize", resizeHandler);
  };

  receive((event) => {
    if (event.type === "stopListening") {
      console.log("Stopping listening");
      removeListener();
    }
  });

  return () => {
    console.log("Cleaning up");
    removeListener();
  };
});

const isSupported = () => Hls.isSupported;

const runListener = fromCallback(({ sendBack, receive, input }) => {
  //const videoElement = input.videoRef.current;
  //if (videoElement) {
  //console.log("Video ID:", videoElement.id);
  //}
  //console.log(input.videoRef);
  // If you are using the ESM version of the library (hls.mjs), you
  // should specify the "workerPath" config option here if you want
  // web workers to be used. Note that bundlers (such as webpack)
  // will likely use the ESM version by default.
  //var hls = new Hls();
  // bind them together
  //hls.attachMedia(video);
  // MEDIA_ATTACHED event is fired by hls object once MediaSource is ready
  //hls.on(Hls.Events.MEDIA_ATTACHED, function () {
  //console.log("video and hls.js are now bound together !");
  //});
  //console.log("gonna listen");
  /*
    var hls = new Hls();

    hls.on(Hls.Events.MEDIA_ATTACHED, function () {
      console.log("video and hls.js are now bound together !");
    });

    return () => {};
    */
});

function setHlsMachine() {
  const hlsMachine = setup({
    actors: {
      runListener,
    },
    guards: {
      isSupported,
    },
  }).createMachine({
    id: "hls",
    initial: "init",
    states: {
      init: {
        on: {
          LISTEN: {
            target: "listening",
          },
        },
        /*
        entry: [
          {
            guard: "isSupported",
            target: "listening",
          },
          {
            target: "notSupported",
          },
        ],
        */
      },
      listening: {},
      notSupported: {
        type: "final",
      },
    },
  });

  return hlsMachine;
}

const hlsMachine = setup({
  actors: {
    runListener,
  },
  guards: {
    isSupported,
  },
}).createMachine({
  id: "hls",
  initial: "init",
  states: {
    init: {
      on: {
        LISTEN: {
          target: "listening",
        },
      },
      /*
      entry: [
        {
          guard: "isSupported",
          target: "listening",
        },
        {
          target: "notSupported",
        },
      ],
      */
    },
    listening: {},
    notSupported: {
      type: "final",
    },
  },
});

// function called
// video element printed to dom
// machine is in idle state
// useEffect fires -> send({ type: "SET_VIDEO_REF", ref: videoRef.current })
// -> guard isSupported -> action set videoRef context -> target -> listening

function App() {
  const videoRef = useRef(null);

  const [state, send] = useMachine(hlsMachine);

  useEffect(() => {
    console.log(videoRef.current);
  }, [videoRef]);

  //useEffect(() => {
  //if (state.matches("init") && videoRef.current) {
  //send({ type: "LISTEN" });
  //}
  //}, [state, videoRef, send]);

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div
        className="container"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        <video
          id="video"
          ref={videoRef}
          autoPlay
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        ></video>
      </div>
    </div>
  );
}

export default App;
