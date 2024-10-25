import { useRef, useEffect } from "react";
import { useMachine } from "@xstate/react";
import Hls from "hls.js";
import { assign, enqueueActions, fromCallback, sendTo, setup } from "xstate";

const isSupported = () => Hls.isSupported;

const handleListener = fromCallback(({ sendBack, receive }) => {
  let hls;

  receive((event) => {
    if (event.type === "start") {
      const src =
        "https://bcovlive-a.akamaihd.net/1ad942d15d9643bea6d199b729e79e48/us-east-1/6183977686001/profile_1/chunklist.m3u8";

      var video = document.getElementById("video");

      var hls = new Hls();

      hls.loadSource(src);

      hls.attachMedia(video);

      Object.values(Hls.Events).forEach((hlsEvent) => {
        hls.on(hlsEvent, function (event, data) {
          console.log(event);
          console.log(`HLS Event: ${hlsEvent}`, data);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        var errorType = data.type;
        var errorDetails = data.details;
        var errorFatal = data.fatal;

        switch (data.details) {
          case Hls.ErrorDetails.MANIFEST_LOAD_ERROR:
            console.error(src, "manifest load error");
            sendBack({ type: "MANIFEST_LOAD_ERROR" });
            break;
          case Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT:
            console.error(src, "manifest load timeout");
            sendBack({ type: "MANIFEST_LOAD_TIMEOUT" });
            break;
          case Hls.ErrorDetails.MANIFEST_PARSING_ERROR:
            console.error(src, "manifest parsing error");
            sendBack({ type: "MANIFEST_PARSING_ERROR" });
            break;
          default:
            break;
        }
      });

      /*
      hls.on(Hls.Events.BUFFER_APPENDED, function () {
        console.log("Data appended to buffer.");
      });

      hls.on(Hls.Events.BUFFER_STALLED, function () {
        console.log("Buffer is stalled, waiting for data...");
      });

      hls.on(Hls.Events.BUFFER_APPENDING, function () {
        console.log("Appending data to buffer...");
      });
      */

      hls.on(Hls.Events.MANIFEST_PARSED, function (event, data) {
        console.log(
          "Manifest loaded, found " + data.levels.length + " quality levels"
        );
        video.play();
      });
    }

    if (event.type === "stop") {
      hls.destroy();
    }
  });

  return () => {
    hls.destroy();
  };
});

const hlsMachine = setup({
  actors: {
    handleListener,
  },
  guards: {
    isSupported,
  },
}).createMachine({
  id: "hls",
  initial: "idle",
  context: {
    videoRef: undefined,
  },
  invoke: {
    id: "listener",
    src: "handleListener",
  },
  states: {
    idle: {
      on: {
        SET_VIDEO_REF: [
          {
            guard: "isSupported",
            actions: [
              sendTo("listener", ({ event }) => {
                return { type: "start", data: event.ref };
              }),
            ],
          },
          {
            target: "notSupported",
          },
        ],
        MANIFEST_LOAD_ERROR: {
          target: "retryManifest",
        },
        MANIFEST_LOAD_TIMEOUT: {
          target: "retryManifest",
        },
        MANIFEST_PARSING_ERROR: {
          target: "retryManifest",
        },
      },
    },
    retryManifest: {},
    notSupported: {
      type: "final",
    },
  },
});

function App() {
  const videoRef = useRef(null);

  const [state, send] = useMachine(hlsMachine);

  useEffect(() => {
    if (state.value === "idle" && videoRef.current) {
      send({ type: "SET_VIDEO_REF", ref: videoRef.current });
    }
  }, [state.value, videoRef, send]);

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div
        className="container"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {state.matches("retryManifest") && (
          <div className="loading-message">Offline</div>
        )}
        {state.matches("idle") && (
          <div className="loading-message">Loading</div>
        )}
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
