import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import api from "@/lib/api";
import { connectSocket, socket } from "@/lib/socket";
import type { UserSummary } from "@/lib/types";

type FollowChange = {
  follower: UserSummary;
  following: UserSummary;
  followersCount: number;
};

type FollowListType = "followers" | "following";

type FollowListEvent = {
  type: "created" | "deleted";
  change: FollowChange;
};

type RoomJoinAck = {
  ok: boolean;
  error?: string;
};

function applyFollowListEvent(
  users: UserSummary[],
  event: FollowListEvent,
  userId: number,
  listType: FollowListType
): UserSummary[] {
  const { follower, following } = event.change;

  if (!follower?.id || !following?.id) {
    return users;
  }

  const belongsToList =
    listType === "followers"
      ? Number(following.id) === userId
      : Number(follower.id) === userId;

  if (!belongsToList) {
    return users;
  }

  const changedUser =
    listType === "followers" ? follower : following;

  if (event.type === "created") {
    const alreadyExists = users.some(
      (user) => Number(user.id) === Number(changedUser.id)
    );

    if (alreadyExists) {
      return users;
    }

    return [changedUser, ...users];
  }

  return users.filter(
    (user) => Number(user.id) !== Number(changedUser.id)
  );
}

/**
 * Synchronizes the authenticated user's Followers / Following list
 * with PostgreSQL whenever the socket connects or reconnects.
 */
export function useFollowListSocket(
  userId: number | null,
  listType: FollowListType,
  setUsers: Dispatch<SetStateAction<UserSummary[]>>
) {
  useEffect(() => {
    if (!userId) return;

    let active = true;
    let isSyncing = false;
    let syncAgain = false;

    let pendingEvents: FollowListEvent[] = [];

    const handleEvent = (event: FollowListEvent) => {
      if (!active) return;

      // Buffer socket events while fetching the authoritative snapshot.
      if (isSyncing) {
        pendingEvents.push(event);
        return;
      }

      setUsers((currentUsers) =>
        applyFollowListEvent(
          currentUsers,
          event,
          userId,
          listType
        )
      );
    };

    const synchronizeList = async () => {
      if (!active) return;

      // If synchronization is already running, request another pass.
      if (isSyncing) {
        syncAgain = true;
        return;
      }

      isSyncing = true;

      try {
        do {
          syncAgain = false;
          pendingEvents = [];

          try {
            const response = await api.get(
              `/users/${userId}/${listType}`
            );

            if (!active) return;

            // Apply events received during the API request on top
            // of the latest database snapshot.
            const receivedEvents = pendingEvents;
            pendingEvents = [];

            const snapshot: UserSummary[] = Array.isArray(
              response.data
            )
              ? response.data
              : [];

            const synchronizedUsers = receivedEvents.reduce(
              (users, event) =>
                applyFollowListEvent(
                  users,
                  event,
                  userId,
                  listType
                ),
              snapshot
            );

            setUsers(synchronizedUsers);
          } catch (error) {
            console.error(
              `Failed to synchronize ${listType}:`,
              error
            );

            // Preserve existing data and still apply received events.
            const receivedEvents = pendingEvents;
            pendingEvents = [];

            if (active && receivedEvents.length > 0) {
              setUsers((currentUsers) =>
                receivedEvents.reduce(
                  (users, event) =>
                    applyFollowListEvent(
                      users,
                      event,
                      userId,
                      listType
                    ),
                  currentUsers
                )
              );
            }
          }
        } while (syncAgain && active);
      } finally {
        isSyncing = false;

        // Apply any events received after the last snapshot was processed.
        if (active && pendingEvents.length > 0) {
          const remainingEvents = pendingEvents;
          pendingEvents = [];

          setUsers((currentUsers) =>
            remainingEvents.reduce(
              (users, event) =>
                applyFollowListEvent(
                  users,
                  event,
                  userId,
                  listType
                ),
              currentUsers
            )
          );
        }
      }
    };

    const joinUserRoom = () => {
      socket.emit(
        "user:join",
        userId,
        (ack: RoomJoinAck) => {
          if (!active) return;

          if (!ack?.ok) {
            console.error(
              "Failed to join authenticated user room:",
              ack?.error
            );
            return;
          }

          // Always refresh after joining or rejoining the room.
          void synchronizeList();
        }
      );
    };

    const handleFollowCreated = (change: FollowChange) => {
      handleEvent({
        type: "created",
        change,
      });
    };

    const handleFollowDeleted = (change: FollowChange) => {
      handleEvent({
        type: "deleted",
        change,
      });
    };

    socket.on("connect", joinUserRoom);
    socket.on("follow:created", handleFollowCreated);
    socket.on("follow:deleted", handleFollowDeleted);

    connectSocket();

    // The socket might already be connected before this effect runs.
    if (socket.connected) {
      joinUserRoom();
    }

    return () => {
      active = false;

      socket.off("connect", joinUserRoom);
      socket.off("follow:created", handleFollowCreated);
      socket.off("follow:deleted", handleFollowDeleted);
    };
  }, [userId, listType, setUsers]);
}