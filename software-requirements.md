# CODA Software Requirements

NPR Stuff to fix:

TBD:

"3.1.4":
SWE Number: 024
Requirement Text: |
The project manager shall track the actual results and performance of software activities against the software plans.
a. Corrective actions are taken, recorded, and managed to closure.
b. Changes to commitments (e.g., software plans) that have been agreed to by the affected groups and individuals are taken, recorded, and managed.

https://gitlab.fit.nasa.gov/coda/coda-requirements/-/blob/main/README.md

      The project manager shall define and document the acceptance criteria for the software.

https://gitlab.fit.nasa.gov/emss/emss-processes/-/blob/main/README.md

## Introduction

### Purpose of Document

### Project Summary

### Background

### Project Scope

### System Purpose

### Overview of Document

## Software Classification

Per NPR 7150.2... Class F

Ref 3.5.1, 3.5.2

## Rights and Licensing

Who owns EMSS stuff? Stuff built by CX3 is owned by NASA, right?

Ref 3.1.14

## Cost Estimates

Mentioned

Ref 3.2.1, 3.2.2

## Future Support

Mentioned

Also include info on post-development automated testing...setting up CI/CD to run every X days if no pipelines have run.

Ref 3.1.14

## Functional Requirements

1. The system shall ... be a system

4.1.2
The project manager shall establish, capture, record, approve, and maintain software requirements, including requirements for COTS, GOTS, MOTS, OSS, or reused software components, as part of the technical specification.

4.1.5
The project manager shall track and manage changes to the software requirements.

4.1.6
The project manager shall identify, initiate corrective actions, and track until closure inconsistencies among requirements, project plans, and software products.

4.1.7
The project manager shall perform requirements validation to ensure that the software will perform as intended in the customer environment.

Ref 3.1.14, 3.12.1, 4.1.2, 4.1.5, 4.1.6

## Non-Functional Requirements

### Documentation Requirements

Mentioned

### Reusability Requirements

      The project manager shall specify reusability requirements that apply to its software development activities to enable future reuse of the software, including the models, simulations, and associated data used as inputs for auto-generation of software, for U.S. Government purposes.

      The project manager shall evaluate software for potential reuse by other projects across NASA and contribute reuse candidates to the appropriate NASA internal sharing and reuse software system.  However, if the project manager is not a civil servant, then a civil servant will pre-approve all such software contributions; all software contributions should include, at a minimum, the following information:
      a. Software Title.
      b. Software Description.
      c. The Civil Servant Software Technical POC for the software product.
      d. The language or languages used to develop the software.
      e. Any third party code contained therein and the record of the requisite license or permission received from the third party permitting the Government’s use and any required markings (e.g., required copyright, author, applicable license notices within the software code, and the source of each third-party software component (e.g., software URL & license URL)), if applicable.
      f. Release notes.

Ref 3.10.1, 3.10.2

### Test Requirements

### Reliability

### Usability

### Performance

### Security Requirements

      The project manager shall perform a software cybersecurity assessment on the software components per the Agency security policies and the project requirements, including risks posed by the use of COTS, GOTS, MOTS, OSS, or reused software components.

      The project manager shall test the software and record test results for the required software cybersecurity mitigation implementations identified from the security vulnerabilities and security weaknesses analysis.

      The project manager shall verify that the software code meets the project's secure coding standard by using the results from static analysis tool(s).

      The project manager shall identify software requirements for the collection, reporting, and storage of data relating to the detection of adversarial actions.

Ref 3.11.2, 3.11.5, 3.11.7, 3.11.8

### Supportability

### Online User Documentation and Help

### Interfaces

## The Context Model

### Goal Statement

The goal of the system is to allow SBE to increase sales revenue by x% over the next y years with only a z% increase in sales and customer service staff by
allowing complete and accurate customer and order information to be captured directly from the customer as well as from sales agents
providing customers and sales agents fast access to up-to-date and accurate product information and whitepapers.

### Context Diagram

### System Externals

## Schedule

Ref 3.3.1, 3.3.2, 3.3.3

## Use Cases

### Customer places order

This use case allows a registered customer to place an order for a product.

#### Basic Flow

The use case start when a customer indicates he wants to place an order for the current product being displayed.
The system displays the customer's information: name, street, city, zip, phone, email.
The customer may add or change any of the information.
The system stores any changes. If the zipcode has changed, the system modifies the customer's location.
The system requests the quantity to order and the shipping address.
The customer enters quantity and shipping address.
The system displays the payment options available to this customer.
The customer selects a payment option.
The system completes the payment by executing use case Charge Customer or Bill Customer depending on which option was selected.
The system stores the order information, decreases the quantity on hand for the product and sends the order details to Shipping.
The system displays a order completion message and sends a receipt to the user.

#### Alternative Flows:

Step 9:
If the selected payment method could not be validated, go to step 8 to get another payment option.
Step 10:
If the quantity on hand is not sufficient for this order, a message is sent to the customer and the use case is canceled.

Preconditions: The customer is logged in and has completed a search for the product to be ordered
Postconditions: The product is sold.
Business Rules: If a customer has been previously authorized for billing by a sales agent, the customer may billed for the order. Otherwise the customer must pay in full by credit card at the time of the order.
