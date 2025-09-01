import axios from "axios";
import userModel from "../models/userModel.js";
import FormData from "form-data";

export const generateImage = async (req, res) => {
  try {
    const userId = req.user.id; // ✅ from middleware
    const { prompt } = req.body;

    // Validate user
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    if (user.creditBalance <= 0) {
      return res.status(403).json({
        success: false,
        message: "No Credit Balance",
        creditBalance: user.creditBalance,
      });
    }

    // Prepare request to ClipDrop
    const formData = new FormData();
    formData.append("prompt", prompt);

    const { data } = await axios.post(
      "https://clipdrop-api.co/text-to-image/v1",
      formData,
      {
        headers: {
          "x-api-key": process.env.CLIPDROP_API,
          ...formData.getHeaders(),
        },
        responseType: "arraybuffer",
      }
    );

    // Convert binary image to base64
    const base64Image = Buffer.from(data, "binary").toString("base64");
    const resultImage = `data:image/png;base64,${base64Image}`;

    // ✅ Atomically decrement credits and return updated user
    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { $inc: { creditBalance: -1 } },
      { new: true } // return updated doc
    ).select("creditBalance name");

    res.json({
      success: true,
      message: "Image Generated",
      creditBalance: updatedUser.creditBalance, // ✅ fresh balance
      resultImage,
    });
  } catch (error) {
    console.error("GenerateImage Error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
