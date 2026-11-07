"use client";
import ContactForm from "@/components/forms/contact-form";
import { EditorElement } from "@/providers/editor/editor-provider";
import React from "react";
import ElementWrapper from "./element-wrapper";

type Props = {
  element: EditorElement;
};

const ContactFormComponent = ({ element }: Props) => (
  <ElementWrapper element={element} className="flex w-full items-center justify-center">
    <ContactForm title="Contact Us" />
  </ElementWrapper>
);

export default ContactFormComponent;
