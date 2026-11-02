import React, { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { formatLook, parseLook, randomLook } from "../../shared/looks.js";
import { Modal } from "../components.jsx";
import { FaceEditor } from "../ui/FaceEditor.jsx";
import { Button } from "../ui/kit.jsx";
import { sfx } from "../ui/sfx.js";

/** Six boxes that pop as you type. A real, labelled input sits on top so paste, autofill and screen readers work. */
function CodeBoxes({ value, onChange }) {
  const input = useRef();
  return (
    <div className="code-field">
      <span className="code-label">Room code</span>
      <div className="code-boxes" onClick={() => input.current?.focus()}>
        {Array.from({ length: 6 }, (_, i) => (
          <span
            key={i + (value[i] || "")}
            className={`code-box ${value[i] ? "filled" : ""} ${i === value.length ? "active" : ""}`}
            aria-hidden="true"
          >
            {value[i] || ""}
          </span>
        ))}
        <input
          ref={input}
          aria-label="Room code"
          value={value}
          onChange={(e) => {
            const next = e.target.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 6);
            if (next.length > value.length) sfx("tap");
            onChange(next);
          }}
          required
          maxLength={6}
          minLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="code-real"
        />
      </div>
    </div>
  );
}

export function Entry({
  type,
  onClose,
  enter,
  busy,
  connected,
  code = "",
  startMode = "",
}) {
  const [name, setName] = useState(localStorage.getItem("sd-name") || ""),
    [avatar, setAvatar] = useState(() => {
      const saved = parseLook(localStorage.getItem("sd-avatar"));
      return formatLook(saved || randomLook());
    }),
    [roomCode, setCode] = useState(code),
    [spectator, setSpectator] = useState(false);
  return (
    <Modal
      title={
        type === "create"
          ? "Your room. Your kind of weird."
          : "The gang’s waiting."
      }
      onClose={onClose}
    >
      <p className="muted">
        Build a face and pick a name your friends will recognize. Everyone in
        the room gets a different look.
      </p>
      {type === "create" && startMode && (
        <p className="mode-hint">
          Starting with <b>{startMode}</b>. You can change it in the lobby.
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          localStorage.setItem("sd-name", name);
          localStorage.setItem("sd-avatar", avatar);
          await enter({
            create: type === "create",
            code: roomCode.toUpperCase().trim(),
            name,
            avatar,
            spectator,
          });
        }}
      >
        <FaceEditor value={avatar} onChange={setAvatar} />
        <label className="field">
          Your nickname
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Something your friends call you"
            required
            maxLength={20}
            autoComplete="nickname"
          />
        </label>
        {type === "join" && <CodeBoxes value={roomCode} onChange={setCode} />}
        <label className="check-row">
          <input
            type="checkbox"
            checked={spectator}
            onChange={(e) => setSpectator(e.target.checked)}
          />
          Just watching? Join as a spectator.
        </label>
        <Button
          variant="primary"
          size="lg"
          className="wide"
          type="submit"
          loading={busy}
          disabled={!connected}
        >
          {busy
            ? "Getting the studio ready…"
            : !connected
              ? "Connecting to the studio…"
              : type === "create"
                ? "Create room"
                : "Join room"}
          {!busy && <ArrowRight size={18} />}
        </Button>
        <p className="small muted center">
          No accounts. No downloads. Only excellent company.
        </p>
      </form>
    </Modal>
  );
}
