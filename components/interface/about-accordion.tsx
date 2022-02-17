import {
  Accordion,
  AccordionItem,
  AccordionItemHeading,
  AccordionItemButton,
  AccordionItemPanel,
} from "react-accessible-accordion";

/** CSS is at /public/accordion-styles.css */

export default function AboutAccordion() {
  return (
    <Accordion allowZeroExpanded={true}>
      <AccordionItem>
        <AccordionItemHeading>
          <AccordionItemButton>The Team</AccordionItemButton>
        </AccordionItemHeading>
        <AccordionItemPanel>
          <ul>
            <li>
              <div className={"creditHeading"}>Benjamin Feist</div>
              <div>
                Concept, Software Engineering
                <br />{" "}
                <a className={"smallText"} href={"mailto:benjamin.f.feist@nasa.gov"}>
                  Email for help
                </a>
              </div>
            </li>
            <li>
              <div className={"creditHeading"}>David Charney</div>
              <div>Interaction and Visual Design</div>
            </li>
            <li>
              <div className={"creditHeading"}>Cameron Pittman</div>
              <div>Software Engineering</div>
            </li>
            <li>
              <div className={"creditHeading"}>James Montalvo</div>
              <div>EMSS Lead, Software Engineering</div>
            </li>
            <li>
              <div className={"creditHeading"}>Matthew Miller</div>
              <div>Project Management</div>
            </li>
          </ul>
        </AccordionItemPanel>
      </AccordionItem>
      <AccordionItem>
        <AccordionItemHeading>
          <AccordionItemButton>Useful Links</AccordionItemButton>
        </AccordionItemHeading>
        <AccordionItemPanel>
          <ul>
            <li>
              <a href={"https://wiki.jsc.nasa.gov/exploration/index.php/CODA"} target={"_blank"}>
                CODA Exploration Wiki Page
              </a>
            </li>
            <li>
              <a
                href={"https://wiki.jsc.nasa.gov/exploration/index.php/EVA_Mission_System_Software"}
                target={"_blank"}
              >
                EMSS Exploration Wiki Page
              </a>
            </li>
          </ul>
        </AccordionItemPanel>
      </AccordionItem>
    </Accordion>
  );
}
