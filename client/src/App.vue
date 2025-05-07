<template>
    <div style="width: 100%; height: 100%">
        <div class="entry" style="display: flex">
            <el-input type="text" v-model="roomId" placeholder="输入房间号" />
            <el-button @click="join" type="primary" style="margin-left: 10px"
                >加入</el-button
            >
            <el-button @click="leave" type="primary">离开</el-button>
        </div>
        <div class="video-box">
            <div style="width: 50%">
                <h1>本地</h1>
                <video
                    ref="localVideoRef"
                    autoplay
                    muted
                    playsinline
                    style="width: 100%; height: 100%"
                >
                    本地
                </video>
                <div style="display: flex">
                    <el-select
                        v-model="videoDeviceId"
                        placeholder="请选择视频设备"
                        @change="
                            (value) => {
                                deviceChange(value, 'videoinput');
                            }
                        "
                    >
                        <el-option
                            v-for="(item, index) in videoDeviceList"
                            :key="index"
                            :value="item.deviceId"
                            :label="item.label"
                        ></el-option>
                    </el-select>
                    <el-select
                        v-model="audioDeviceId"
                        placeholder="请选择音频设备"
                        @change="
                            (value) => {
                                deviceChange(value, 'audioinput');
                            }
                        "
                    >
                        <el-option
                            v-for="(item, index) in audioDeviceList"
                            :key="index"
                            :value="item.deviceId"
                            :label="item.label"
                        ></el-option>
                    </el-select>
                </div>
            </div>

            <div style="width: 50%">
                <h1>远端</h1>
                <video ref="remoteVideoRef" autoplay playsinline>远端</video>
            </div>
        </div>
    </div>
</template>
<script setup>
import { ref, onMounted } from "vue";
import { io } from "socket.io-client";
const roomId = ref();
const localVideoRef = ref();
const remoteVideoRef = ref();
const videoDeviceId = ref();
const audioDeviceId = ref();
const audioDeviceList = ref([]);
const videoDeviceList = ref([]);
let roomFull = false;
var localUserId = Math.random().toString(36).substring(2); // 本地uid
var remoteUserId = -1; // 对端

var localStream = null; //本地媒体流
var remoteStream = null; //远端媒体流
var pc = null;

/* 连接socket.io服务器 */
var socket = io("http://localhost:3000");

//有人创建了房间
socket.on("new-peer", (res) => {
    if (res !== "createRoom") {
        console.log("有人加入进来id:", res);
        handleRemoteNewPeer(res);
    }
    doOffer();
});

//接收远端offer信息
socket.on("peer-offer", (res) => {
    console.log("客户端接收peer-offer", res);
    if (pc == null) {
        createPeerConnection();
    }
    pc.setRemoteDescription(res.msg);
    doAnswer();
});

//接收远端answer信息
socket.on("peer-answer", (res) => {
    console.log("客户端接收peer-answer", res);
    pc.setRemoteDescription(res.msg);
});

//收到离开房间信息
socket.on("peer-leave", (res) => {
    console.log("有人离开房间id:", res);
    //把对方视频置空
    remoteVideoRef.value.srcObject = null;
});

//接收远端candidate信息
socket.on("peer-candidate", (res) => {
    console.log("客户端接收peer-candidate", res);
    var candidateMsg = {
        sdpMLineIndex: res.msg.label,
        sdpMid: res.msg.id,
        candidate: res.msg.candidate,
    };
    var candidate = new RTCIceCandidate(candidateMsg);
    pc.addIceCandidate(candidate).catch((e) => {
        console.log("pc.addIceCandidate Error");
    });
});

function getAllDevices() {
    navigator.mediaDevices.enumerateDevices().then((res) => {
        videoDeviceList.value = res.filter((item) => item.kind == "videoinput");
        audioDeviceList.value = res.filter((item) => item.kind == "audioinput");
    });
}

//加入房间回调方法
function handleRemoteNewPeer(res) {
    remoteUserId = res.uid;
}

//发送offer方法
function doOffer() {
    console.log("doOffer方法");
    if (pc == null) {
        createPeerConnection();
    } else {
        console.log("doOffer方法进入offer,pc为:", pc);
        pc.createOffer()
            .then((offer) => {
                pc.setLocalDescription(offer)
                    .then(function () {
                        var jsonMsg = {
                            cmd: "offer",
                            roomId: roomId.value,
                            uid: localUserId,
                            remoteUid: remoteUserId,
                            msg: offer,
                        };
                        socket.emit("offer", jsonMsg);
                    })
                    .catch(() => {
                        console.log("offer Error");
                    });
            })
            .catch(() => {
                console.log("createOffer Error");
            });
    }
}
function deviceChange(deviceId, type) {
    console.log("设备修改", deviceId, type);

    console.log(pc)
}
//发送answer方法
function doAnswer() {
    pc.createAnswer()
        .then((answer) => {
            pc.setLocalDescription(answer)
                .then(function () {
                    var jsonMsg = {
                        cmd: "answer",
                        roomId: roomId.value,
                        uid: localUserId,
                        remoteUid: remoteUserId,
                        msg: answer,
                    };
                    socket.emit("answer", jsonMsg);
                })
                .catch(() => {
                    console.log("answer Error");
                });
        })
        .catch(() => {
            console.log("createAnswer Error");
        });
}

function createPeerConnection() {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.ontrack = handleRemoteStreamAdd;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
}

//ice候选项方法
function handleIceCandidate(e) {
    if (e.candidate) {
        var candidateJson = {
            label: e.candidate.sdpMLineIndex,
            id: e.candidate.sdpMid,
            candidate: e.candidate.candidate,
        };
        var jsonMsg = {
            cmd: "candidate",
            roomId: roomId.value,
            uid: localUserId,
            remoteUid: remoteUserId,
            msg: candidateJson,
        };
        socket.emit("candidate", jsonMsg);
    }
}
//获取远端媒体流处理
const handleRemoteStreamAdd = (e) => {
    remoteStream = e.streams[0];
    console.log("远端媒体流", remoteStream);
    remoteVideoRef.value.srcObject = remoteStream;
};
function initLocalStream() {
    const constraints = {
        audio: audioDeviceId.value
            ? { deviceId: { exact: audioDeviceId.value } }
            : false,
        video: videoDeviceId.value
            ? {
                  deviceId: { exact: videoDeviceId.value },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
              }
            : false,
    };
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(openLocalStream)
        .catch((e) => {
            console.log(e);
            alert("error:" + e.name);
        });
}
//把视频流赋给dom标签
function openLocalStream(stream) {
    console.log("打开了本地流");
    doJoin(roomId.value); //调用加入房间的方法

    //房间已满人通知
    socket.on("roomFull", (res) => {
        alert(res);
        closeLocalStream(stream);
        return;
    });
    console.log(localVideoRef.value.srcObject);
    localVideoRef.value.srcObject = stream;
    localStream = stream;
    roomFull = false;
}
//关闭媒体
function closeLocalStream(stream) {
    // 停止所有媒体轨道
    stream.getTracks().forEach((track) => {
        track.stop();
    });
    // 关闭视频元素
    localVideoRef.value.pause();
    localVideoRef.value.srcObject = null;
}

//加入房间的方法
function doJoin(roomId) {
    var jsonMsg = {
        cmd: "join",
        roomId: roomId,
        uid: localUserId,
    };
    socket.emit("join", jsonMsg);
}

//离开房间方法
function doLeave() {
    var jsonMsg = {
        cmd: "leave",
        roomId: roomId.value,
        uid: localUserId,
    };

    //置空对方和本地的媒体流
    remoteVideoRef.value.srcObject = null;
    localVideoRef.value.srcObject = null;
    //关闭RTCPeerConnection
    if (pc != null) {
        pc.close();
        pc = null;
    }
    //媒体轨道停止，关闭本地流
    if (localStream != null) {
        localStream.getTracks().forEach((track) => {
            track.stop();
        });
    }
    socket.emit("leave", jsonMsg);
}

onMounted(() => {
    getAllDevices();
});

function join() {
    if (!roomId.value) {
        alert("请输入房间ID");
        return;
    }
    initLocalStream(); //调用打开摄像头和麦克风
}

function leave() {
    doLeave();
}
</script>

<style scoped>
.video-box {
    display: flex;
    flex-direction: row;
}
</style>
