import { useRef, useEffect } from "react";
import { useMachine } from "@xstate/react";
import Hls from "hls.js";
import { assign, enqueueActions, fromCallback, sendTo, setup } from "xstate";

const isSupported = () => Hls.isSupported;

const handleListener = fromCallback(({ sendBack, receive }) => {
  let hls;

  receive((event) => {
    if (event.type === "start") {
      var video = document.getElementById("video");

      var hls = new Hls();

      hls.loadSource("https://fe.tring.al/delta/105/out/u/rdghfhsfhfshs.m3u8");

      hls.attachMedia(video);

      video.play();

      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        console.log("video and hls.js are now bound together !");
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
              sendTo("listener", ({ context, event }) => {
                return { type: "start", data: event.ref };
              }),
            ],
          },
          {
            target: "notSupported",
          },
        ],
      },
    },
    notSupported: {
      type: "final",
    },
  },
});

function App() {
  const videoRef = useRef(null);

  const [state, send] = useMachine(hlsMachine);

  useEffect(() => {
    if (state.matches("idle") && videoRef.current) {
      send({ type: "SET_VIDEO_REF", ref: videoRef.current });
    }
  }, [state.value, videoRef, send]);

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
