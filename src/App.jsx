import { useRef, useEffect } from "react";
import { useMachine } from "@xstate/react";
import Hls from "hls.js";
import { assign, enqueueActions, fromCallback, sendTo, setup } from "xstate";

const isSupported = () => Hls.isSupported;

const handleListener = fromCallback(({ sendBack, receive }) => {
  let hls;

  receive((event) => {
    if (event.type === "start") {
      const src = "https://stream3.camara.gov.br/tv1/manifest.m3u8";

      //const src =
      //"https://bcovlive-a.akamaihd.net/1ad942d15d9643bea6d199b729e79e48/us-east-1/6183977686001/profile_1/chunklist.m3u8";

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

      hls.on(Hls.Events.MANIFEST_LOADED, function () {
        sendBack({
          type: "MANIFEST_LOADED",
        });
        video.play();
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        sendBack({ type: "FRAG_BUFFERED" });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
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
    }

    if (event.type === "STREAMING_POLL") {
      console.log("!!!!STREAMINGPOLL!!!!");
      sendBack({ type: "POLL" });
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
  initial: "initializing",
  context: {
    videoRef: undefined,
  },
  invoke: {
    id: "listener",
    src: "handleListener",
  },
  states: {
    initializing: {
      on: {
        SET_VIDEO_REF: [
          {
            guard: "isSupported",
            actions: [
              sendTo("listener", ({ event }) => {
                return { type: "start", data: event.ref };
              }),
            ],
            target: "connecting",
          },
          {
            target: "notSupported",
          },
        ],
      },
    },
    connecting: {
      on: {
        MANIFEST_LOADED: {
          target: "connected",
        },
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
    connected: {
      initial: "buffering",
      states: {
        buffering: {
          on: {
            FRAG_BUFFERED: {
              target: "streaming",
            },
          },
        },
        streaming: {
          initial: "polling",
          states: {
            polling: {
              on: {
                POLL: {
                  actions: () => console.log("hi"),
                  reenter: true,
                  target: "polling",
                },
              },
              after: {
                2000: {
                  actions: [
                    sendTo("listener", () => {
                      return { type: "STREAMING_POLL" };
                    }),
                  ],
                },
              },
            },
          },
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
    if (state.value === "initializing" && videoRef.current) {
      send({ type: "SET_VIDEO_REF", ref: videoRef.current });
    }
  }, [state.value, videoRef, send]);

  return (
    <div className="App" style={{ margin: 0, padding: 0, overflow: "hidden" }}>
      <div
        className="container"
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        {state.matches("connected.buffering") && (
          <div className="offline-message">Buffering</div>
        )}
        {state.matches("retryManifest") && (
          <div className="offline-message">Offline</div>
        )}
        {state.matches("connecting") && (
          <div className="loading-message">Connecting</div>
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
