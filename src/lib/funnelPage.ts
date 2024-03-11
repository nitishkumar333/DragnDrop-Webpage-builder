import mongoose from "mongoose";

const funnelPageSchema = new mongoose.Schema(
  {
    id: {
      type: String,
    },
    name: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      default: null,
    },
    previewImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.funnelPage ||
  mongoose.model("funnelPage", funnelPageSchema);
